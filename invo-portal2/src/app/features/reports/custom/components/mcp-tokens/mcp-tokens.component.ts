import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { customReportsEditPrivilegeFullKey } from '../../custom-reports.privileges';
import {
  CreatedMcpToken,
  McpConnectInfo,
  McpToken,
  McpTokenScope,
  McpTokensService,
  OAuthConnection,
} from '../../services/mcp-tokens.service';

type TokenStatus = 'active' | 'expired' | 'revoked';

/**
 * MCP access tokens screen — mounted at /reports/builder/mcp-tokens.
 *
 * An employee creates tokens that let an AI client build reports on their
 * behalf with exactly their own access. The secret is shown once, right
 * after creation, together with the client connection config.
 */
@Component({
  selector: 'app-mcp-tokens',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SearchDropdownComponent],
  templateUrl: './mcp-tokens.component.html',
  styleUrls: ['./mcp-tokens.component.scss'],
})
export class McpTokensComponent implements OnInit {
  readonly expiryOptions: { days: number | null; label: string }[] = [
    { days: 30, label: 'CUSTOM_REPORTS.MCP_TOKENS.EXPIRY_DAYS' },
    { days: 90, label: 'CUSTOM_REPORTS.MCP_TOKENS.EXPIRY_DAYS' },
    { days: 365, label: 'CUSTOM_REPORTS.MCP_TOKENS.EXPIRY_DAYS' },
    { days: null, label: 'CUSTOM_REPORTS.MCP_TOKENS.EXPIRY_NEVER' },
  ];

  /** The expiry dropdown works on option objects; the form keeps `expiresInDays`. */
  get selectedExpiry(): { days: number | null; label: string } | null {
    return this.expiryOptions.find(o => o.days === this.expiresInDays) ?? null;
  }
  setExpiry(opt: { days: number | null; label: string } | null): void {
    this.expiresInDays = opt ? opt.days : null;
  }
  expiryLabel = (opt: { days: number | null; label: string }): string =>
    this.translate.instant(opt.label, { n: opt.days });
  sameExpiry = (a: { days: number | null }, b: { days: number | null }): boolean => a?.days === b?.days;

  /** Saving reports through MCP needs the same Edit privilege as the builder. */
  readonly canWrite: boolean;

  tokens: McpToken[] = [];
  loading = false;
  loadError = '';

  name = '';
  allowWrite = false;
  expiresInDays: number | null = 90;
  creating = false;
  createError = '';

  /** Holds the secret only until the user dismisses the panel. */
  created: CreatedMcpToken | null = null;
  serverUrl = '';

  connectInfo: McpConnectInfo | null = null;
  infoError = '';
  connections: OAuthConnection[] = [];
  connectionsLoading = false;
  connectionsError = '';
  disconnectingId: string | null = null;

  revokingId: string | null = null;

  constructor(
    private tokensService: McpTokensService,
    private router: Router,
    private translate: TranslateService,
    private modal: ModalService,
    private toast: ToastService,
    privileges: PrivilegeService
  ) {
    this.canWrite = privileges.check(customReportsEditPrivilegeFullKey);
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadConnectInfo(), this.loadTokens()]);
  }

  async loadConnectInfo(): Promise<void> {
    this.infoError = '';
    try {
      this.connectInfo = await this.tokensService.getConnectInfo();
      this.serverUrl = this.connectInfo.serverUrl || '';
      if (this.connectInfo.oauthEnabled) await this.loadConnections();
    } catch (error: any) {
      this.infoError = error?.message || '';
    }
  }

  async loadConnections(): Promise<void> {
    this.connectionsLoading = true;
    this.connectionsError = '';
    try {
      this.connections = await this.tokensService.listConnections();
    } catch (error: any) {
      this.connectionsError = error?.message || '';
    } finally {
      this.connectionsLoading = false;
    }
  }

  async disconnectApp(connection: OAuthConnection): Promise<void> {
    const confirmed = await this.confirm({
      title: this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.DISCONNECT_CONFIRM_TITLE', { name: connection.clientName }),
      message: this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.DISCONNECT_CONFIRM_TEXT'),
      confirm: this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.DISCONNECT'),
      cancel: this.translate.instant('CUSTOM_REPORTS.COMMON.CANCEL'),
    });
    if (!confirmed) return;

    this.disconnectingId = connection.id;
    try {
      await this.tokensService.disconnect(connection.id);
      await this.loadConnections();
    } catch (error: any) {
      this.toast.error(this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.DISCONNECT_FAILED'), error?.message || '');
    } finally {
      this.disconnectingId = null;
    }
  }

  canSaveScopes(scopes: McpTokenScope[]): boolean {
    return !!scopes?.includes('reports:write');
  }

  goBackToReports(): void {
    this.router.navigate(['/reports/custom']);
  }

  async loadTokens(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.tokens = await this.tokensService.list();
    } catch (error: any) {
      this.loadError = error?.message || '';
    } finally {
      this.loading = false;
    }
  }

  async createToken(): Promise<void> {
    const name = this.name.trim();
    if (!name || this.creating) return;

    const scopes: McpTokenScope[] =
      this.allowWrite && this.canWrite ? ['reports:read', 'reports:write'] : ['reports:read'];

    this.creating = true;
    this.createError = '';
    try {
      this.created = await this.tokensService.create({
        name,
        scopes,
        ...(this.expiresInDays != null ? { expiresInDays: this.expiresInDays } : {}),
      });
      this.name = '';
      this.allowWrite = false;
      await this.loadTokens();
    } catch (error: any) {
      this.createError = error?.message || '';
    } finally {
      this.creating = false;
    }
  }

  dismissCreated(): void {
    this.created = null;
  }

  get connectionConfig(): string {
    return JSON.stringify(
      {
        mcpServers: {
          'invo-reports': {
            type: 'http',
            url: this.serverUrl,
            headers: { Authorization: `Bearer ${this.created?.token ?? '<token>'}` },
          },
        },
      },
      null,
      2
    );
  }

  async revokeToken(token: McpToken): Promise<void> {
    const confirmed = await this.confirm({
      title: this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.REVOKE_CONFIRM_TITLE', { name: token.name }),
      message: this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.REVOKE_CONFIRM_TEXT'),
      confirm: this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.REVOKE'),
      cancel: this.translate.instant('CUSTOM_REPORTS.COMMON.CANCEL'),
    });
    if (!confirmed) return;

    this.revokingId = token.id;
    try {
      await this.tokensService.revoke(token.id);
      if (this.created?.id === token.id) this.created = null;
      await this.loadTokens();
    } catch (error: any) {
      this.toast.error(this.translate.instant('CUSTOM_REPORTS.MCP_TOKENS.REVOKE_FAILED'), error?.message || '');
    } finally {
      this.revokingId = null;
    }
  }

  statusOf(token: McpToken): TokenStatus {
    if (token.revokedAt) return 'revoked';
    if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) return 'expired';
    return 'active';
  }

  canSave(token: Pick<McpToken, 'scopes'>): boolean {
    return token.scopes?.includes('reports:write');
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  /** invo-portal2: the SweetAlert confirm becomes the shared ConfirmModal. */
  private async confirm(data: ConfirmModalData): Promise<boolean> {
    return !!(await this.modal
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { size: 'sm', data })
      .afterClosed());
  }

  async copy(text: string): Promise<void> {
    const ok = await this.writeClipboard(text);
    const msg = this.translate.instant(ok ? 'CUSTOM_REPORTS.MCP_TOKENS.COPIED' : 'CUSTOM_REPORTS.MCP_TOKENS.COPY_FAILED');
    if (ok) this.toast.success(msg, undefined, 1500);
    else this.toast.error(msg, undefined, 1500);
  }

  // Falls back to execCommand where the async clipboard API is unavailable
  // (non-secure contexts such as a LAN IP over http).
  private async writeClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
