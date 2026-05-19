// src/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting()); // Take control immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Claim clients immediately
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Default body',
    icon: data.icon || '/assets/icon.png',
    badge: '/assets/badge.png',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Default Title', options)
      
      .catch((err) => console.error('Service Worker: Error showing notification:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});