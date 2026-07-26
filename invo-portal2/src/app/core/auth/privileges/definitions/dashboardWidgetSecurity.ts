import { PrivilegeSetting } from '../models/privilege-setting.model';
import {
  WIDGETS,
  widgetActionKey,
  widgetLabelFromSlug,
} from '../../../../features/dashboard/models/widget-registry';

/**
 * Dashboard-widget access, one action per built-in widget.
 *
 * Actions are generated from the widget registry so adding a widget
 * automatically surfaces its access toggle in the privilege form — no second
 * place to maintain. `superAdminOnly` widgets are omitted: they're never
 * role-configurable (only super admins ever see them). `check()`'s
 * allow-by-default rule means a role sees every widget until an admin turns
 * specific ones off here.
 */
export function dashboardWidgetSecurity() {
  const actions: Record<string, PrivilegeSetting> = {};
  for (const w of WIDGETS) {
    if (w.superAdminOnly) continue;
    actions[widgetActionKey(w.slug)] = new PrivilegeSetting({
      name: widgetLabelFromSlug(w.slug),
      securityType: 'cloud',
    });
  }
  return new PrivilegeSetting({
    name: 'Dashboard Widgets',
    securityType: 'cloud',
    securityGroup: 'dashboard',
    actions,
  });
}
