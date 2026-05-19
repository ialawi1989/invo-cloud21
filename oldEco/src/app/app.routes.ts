import { Routes } from '@angular/router';
import { RenderMode } from '@angular/ssr';
import { AuthGuard } from "src/app/core/guards/auth.guard";
import { CheckoutDeactivateGuard } from "src/app/core/guards/checkout-deactivate.guard";

export const routes: Routes = [
  { path: 'search', loadComponent: () => import('./pages/product-search-results/product-search-results.component').then(m => m.ProductSearchResultsComponent) },
  { path: 'feedback', loadComponent: () => import('./pages/feedback/feedback.component').then(m => m.FeedbackComponent) },
  { path: 'pager', loadComponent: () => import('./pages/pager/service-request-blank/service-request-blank.component').then(m => m.ServiceRequestBlankComponent) },
  { path: 'cart', loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent) },
  { path: 'notifications', loadComponent: () => import('./pages/notification-page/notification-page.component').then(m => m.NotificationPageComponent) },
  { path: 'categories', loadComponent: () => import('./pages/categories/categories.component').then(m => m.CategoriesComponent) },
  { path: 'wishlist', loadComponent: () => import('./pages/wishlist/wishlist.component').then(m => m.WishlistComponent) },
  // { path: 'compare', loadComponent: () => import('./pages/compare/compare.component').then(m => m.CompareComponent) },
  { path: 'my-orders', loadComponent: () => import('./pages/order-list/order-list.component').then(m => m.OrderListComponent) },
  { path: 'my-reservations', loadComponent: () => import('./pages/reservation-list/reservation-list.component').then(m => m.ReservationListComponent) },
  { path: 'order/error', loadComponent: () => import('./pages/order/order-error/order-error.component').then(m => m.OrderErrorComponent) },
  { path: 'order/complete', loadComponent: () => import('./pages/order/order-complete/order-complete.component').then(m => m.OrderCompleteComponent) },
  { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent), canDeactivate: [CheckoutDeactivateGuard] },
  { path: 'order/:id', loadComponent: () => import('./pages/order/order.component').then(m => m.OrderComponent) },
  { path: 'reservation/:id', loadComponent: () => import('./pages/reservation/reservation.component').then(m => m.ReservationComponent) },
  { path: 'appointments', loadComponent: () => import('./pages/appointments/appointments.component').then(m => m.AppointmentsComponent) },
  { path: 'collections/:id', loadComponent: () => import('./pages/collection/collection.component').then(m => m.CollectionComponent) },
  { path: 'shop', loadComponent: () => import('./pages/shop/shop.component').then(m => m.ShopComponent) },
  { path: 'account', loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent), canActivate: [AuthGuard] },
  { path: 'wallet', loadComponent: () => import('./pages/promotions/wallet/wallet.component').then(m => m.WalletComponent) },
  { path: 'wallet/points-statement', loadComponent: () => import('./pages/promotions/points-statement/points-statement.component').then(m => m.PointsStatementComponent) },
  { path: 'customer-tiers', loadComponent: () => import('./pages/promotions/customer-tiers/customer-tiers.component').then(m => m.CustomerTiersComponent) },
  { path: 'wallet/customer-coupons', loadComponent: () => import('./pages/promotions/customer-coupons/customer-coupons.component').then(m => m.CustomerCouponsComponent) },
  { path: 'menu', loadComponent: () => import('./pages/menu/menu.component').then(m => m.MenuComponent) },
  {
    path: ':parent/product/:id',
    loadChildren: () => import("./pages/product/product.module").then(m => m.ProductComponentModule),
    data: { renderMode: RenderMode.Server }
  },
  { path: 'table-reservation', loadComponent: () => import('./pages/table-reservation/table-reservation.component').then(m => m.TableReservationComponent) },
  { path: 'error', loadComponent: () => import('./pages/error/error.component').then(m => m.ErrorComponent) },
  { path: '#', loadComponent: () => import('./pages/blank/blank.component').then(m => m.BlankComponent) },
  { path: '**', loadComponent: () => import('./pages/page/page.component').then(m => m.PageComponent) }
];