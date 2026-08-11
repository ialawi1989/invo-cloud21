#!/bin/sh
#
# Secrets guard — blocks the failure that has now happened in four repositories.
#
# Background: docs/tickets/aws-credentials-committed-in-tracked-env.md and
# docs/tickets/tracked-env-files-across-repos.md (both in InvoCloudBack).
# Four authors, four repos, three years: every attempt to gitignore a .env
# failed silently. In NewWebsite the ignore line was added the day BEFORE the
# file was indexed, by the same author, and the file was tracked anyway. So
# ordering the fix correctly is not sufficient, and discipline is not the
# remedy. This is.
#
# Usage:
#   scripts/check-secrets.sh --staged   # pre-commit: index + staged additions
#   scripts/check-secrets.sh --all      # CI: index + every tracked file
#
# Install the hook (each developer, once):
#   git config core.hooksPath .githooks
#
# Exit codes: 0 clean, 1 violation. Never exits 0 on a finding — a warning
# that scrolls past is the same as no check at all.

set -u

MODE="${1:---staged}"
ALLOW_FILE=".secrets-guard-allow"

cd "$(git rev-parse --show-toplevel)" || exit 1

# Failure is recorded in a file, not a variable: every scan below runs inside
# a pipeline, and a shell pipeline stage is a subshell whose variable writes
# are discarded. A guard that loses its own verdict is worse than no guard.
FLAG=$(mktemp 2>/dev/null || printf '%s' "${TMPDIR:-/tmp}/secguard.$$")
: > "$FLAG"
trap 'rm -f "$FLAG"' EXIT INT TERM
fail() { echo 1 >> "$FLAG"; }
failed() { [ -s "$FLAG" ]; }

RED=''; YELLOW=''; BOLD=''; OFF=''
if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
  RED=$(printf '\033[31m'); YELLOW=$(printf '\033[33m')
  BOLD=$(printf '\033[1m'); OFF=$(printf '\033[0m')
fi

# ── allowlist ────────────────────────────────────────────────────────────
# Existing, ticketed violations only. A path here is exempt from BOTH checks
# so the guard does not block unrelated work — but it is reported on every
# run, because silently tolerating a known exposure is how this started.
is_allowed() {
  [ -f "$ALLOW_FILE" ] || return 1
  while IFS= read -r pat || [ -n "$pat" ]; do
    case "$pat" in ''|'#'*) continue ;; esac
    pat=$(printf '%s' "$pat" | sed 's/[[:space:]]*$//')
    # shellcheck disable=SC2254
    case "$1" in $pat) return 0 ;; esac
  done < "$ALLOW_FILE"
  return 1
}

# ── patterns ─────────────────────────────────────────────────────────────
# AWS long-term (AKIA) and temporary (ASIA) access key IDs.
AWS_RE='A[KS]IA[0-9A-Z]{16}'

# Sentry AUTH tokens only. The types are sntrys_ (organization) and sntryu_
# (user) — both are `sntr` + two letters + `_`.
#
# NOTE: sntr[a-z]{1,3}_ and NOT sntr[a-z]_ . The single-letter form matches
# `sntra_` and would MISS the real `sntrys_` tokens sitting in
# InvoCloudFront2 and NewWebsite. Verified against the committed prefix.
#
# A public DSN (https://<32-hex>@oNNN.ingest.sentry.io/NNN) is legitimate in
# client code and does NOT match — DSNs carry no sntr*_ prefix. Keeping the
# guard free of false positives is what stops it being disabled.
SENTRY_RE='sntr[a-z]{1,3}_[A-Za-z0-9_+/=-]{16,}'

ENV_RE='(^|/)\.env($|\.)'
ENV_ALLOW_RE='\.env\.(example|sample|template)$'

# ── check 1: env files in the INDEX ──────────────────────────────────────
# Deliberately `git ls-files`, not the staged diff. Every previous attempt
# failed because it only considered newly added files, while the damage was
# done by paths sitting in the index from years earlier. An already-tracked
# .env is invisible to a `git diff --cached` check and to .gitignore alike.
check_tracked_env() {
  git ls-files -z | tr '\0' '\n' | grep -E "$ENV_RE" | grep -vE "$ENV_ALLOW_RE" \
  | while IFS= read -r f; do
      [ -n "$f" ] || continue
      if is_allowed "$f"; then
        printf '%s! known tracked env file (allowlisted): %s%s\n' "$YELLOW" "$f" "$OFF" >&2
        printf '    still exposed — see docs/tickets/tracked-env-files-across-repos.md\n' >&2
        continue
      fi
      fail
      printf '\n%s%sBLOCKED: %s is tracked by git.%s\n' "$RED" "$BOLD" "$f" "$OFF" >&2
      cat >&2 <<EOF

  An env file in the index is committed on every branch, forever, and adding
  it to .gitignore does NOT change that — .gitignore only governs UNTRACKED
  paths. That is the exact mistake this guard exists to stop.

  Fix, in this order:

      git rm --cached "$f"          # untrack; your working copy is kept
      printf '%s\\n' "$f" >> .gitignore
      git commit

  Then VERIFY. This must exit NON-ZERO:

      git ls-files --error-unmatch "$f"

  If it exits 0 the file is still tracked and nothing has been fixed.

  If this file predates the guard and is already ticketed, add it to
  $ALLOW_FILE with a reason. Do not add anything else.
EOF
    done
}

# ── check 2: credential patterns ─────────────────────────────────────────
# Reads content on stdin. Reports the match TYPE and line, never the value.
scan_stdin() {
  label="$1"
  matches=$(grep -nEo "$AWS_RE|$SENTRY_RE" || true)
  [ -n "$matches" ] || return 0
  fail
  printf '\n%s%sBLOCKED: credential-shaped string in %s%s\n' "$RED" "$BOLD" "$label" "$OFF" >&2
  printf '%s\n' "$matches" | while IFS= read -r m; do
    ln=${m%%:*}; val=${m#*:}
    case "$val" in
      AKIA*) kind='AWS access key ID (long-term)' ;;
      ASIA*) kind='AWS access key ID (temporary)' ;;
      sntr*) kind='Sentry AUTH token — not a public DSN' ;;
      *)     kind='credential' ;;
    esac
    printf '    %s: %s [%s…]\n' "$ln" "$kind" "$(printf '%s' "$val" | cut -c1-4)" >&2
  done
  cat >&2 <<'EOF'

  Value not printed. Remove it from the change and read it from the
  environment at runtime instead.

  If it is already committed, deleting it from the working tree is NOT
  enough — it stays in history on every branch. It must be ROTATED.
  See docs/tickets/aws-credentials-committed-in-tracked-env.md
EOF
}

check_content_staged() {
  # ADDED lines only. Context lines would re-flag an untouched value every
  # time a neighbouring line changed, and a guard that cries wolf gets
  # bypassed with --no-verify.
  git diff --cached --name-only -z --diff-filter=ACM | tr '\0' '\n' \
  | while IFS= read -r f; do
      [ -n "$f" ] || continue
      is_allowed "$f" && continue
      git diff --cached -U0 -- "$f" | grep '^+' | grep -v '^+++' | scan_stdin "$f"
    done
}

check_content_all() {
  # CI: every tracked file, so anything that slipped in before the guard
  # existed cannot sit there unnoticed.
  #
  # ONE `git grep` over the tree, not a `git show` per file: this repo tracks
  # ~1900 files including 30MB binaries, and the per-file loop took two
  # minutes. -I skips binaries. -o yields only the match, so no surrounding
  # line — and therefore no secret — is ever held or printed.
  git grep -I -n -E -o "$AWS_RE|$SENTRY_RE" HEAD -- . 2>/dev/null \
  | sed 's/^HEAD://' \
  | while IFS= read -r hit; do
      f=${hit%%:*}; rest=${hit#*:}
      ln=${rest%%:*}; val=${rest#*:}
      is_allowed "$f" && continue
      fail
      case "$val" in
        AKIA*) kind='AWS access key ID (long-term)' ;;
        ASIA*) kind='AWS access key ID (temporary)' ;;
        sntr*) kind='Sentry AUTH token — not a public DSN' ;;
        *)     kind='credential' ;;
      esac
      printf '\n%s%sBLOCKED: credential-shaped string in %s%s\n' "$RED" "$BOLD" "$f" "$OFF" >&2
      printf '    line %s: %s [%s…]\n' "$ln" "$kind" "$(printf '%s' "$val" | cut -c1-4)" >&2
      printf '    value not printed. it must be ROTATED, not just deleted —\n' >&2
      printf '    see docs/tickets/aws-credentials-committed-in-tracked-env.md\n' >&2
    done
}

check_tracked_env
if [ "$MODE" = "--all" ]; then check_content_all; else check_content_staged; fi

if failed; then
  printf '\n%s%ssecrets guard: FAILED%s\n' "$RED" "$BOLD" "$OFF" >&2
  printf 'Emergency bypass: git commit --no-verify\n' >&2
  printf 'Bypassing does not make the credential safe. Rotate it.\n\n' >&2
  exit 1
fi

printf 'secrets guard: clean\n'
exit 0
