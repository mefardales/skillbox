---
name: ionic-framework
description: >
  Ionic Framework best practices for building cross-platform mobile and web
  apps. Use this skill when building hybrid apps with Ionic and Capacitor,
  configuring navigation, theming, native plugins, or preparing builds for
  iOS and Android. Covers Angular/React/Vue integration and mobile performance.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: frontend
  tags: ionic, mobile, capacitor, hybrid, cross-platform
---

# Ionic Framework Best Practices

## Project Structure

Organize features into self-contained modules. Keep Capacitor plugin wrappers in a dedicated service layer so platform-specific code does not leak into components.

```
src/app/
  features/
    auth/       (auth.page.ts, auth.service.ts)
    dashboard/  (dashboard.page.ts, dashboard.page.html)
  shared/
    services/
      camera.service.ts    # wraps Capacitor Camera
      storage.service.ts   # wraps Capacitor Preferences
capacitor.config.ts
```

## Theming with CSS Variables

Use Ionic's CSS custom properties instead of overriding internal styles directly.

```scss
:root {
  --ion-color-primary: #3880ff;
  --ion-color-primary-contrast: #ffffff;
  --ion-font-family: 'Inter', sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ion-background-color: #1a1a2e;
    --ion-text-color: #ffffff;
  }
}
```

## Navigation Patterns

Use tabs for top-level navigation and modals for focused tasks. Do not nest router outlets deeply because they cause layout issues on mobile.

```typescript
const routes: Routes = [
  {
    path: 'tabs', component: TabsPage,
    children: [
      { path: 'home', loadChildren: () => import('./features/home/home.module').then(m => m.HomeModule) },
      { path: 'profile', loadChildren: () => import('./features/profile/profile.module').then(m => m.ProfileModule) },
    ],
  },
];
```

Use modals for tasks that do not need a URL:

```typescript
async openSettings() {
  const modal = await this.modalCtrl.create({
    component: SettingsModal,
    breakpoints: [0, 0.5, 1],
    initialBreakpoint: 0.5,
  });
  await modal.present();
  const { data } = await modal.onDidDismiss();
  if (data?.updated) this.refresh();
}
```

## Native Functionality with Capacitor

Wrap every Capacitor plugin in a service. Check platform availability before calling native APIs so the app degrades gracefully on web.

```typescript
@Injectable({ providedIn: 'root' })
export class CameraService {
  async takePhoto(): Promise<string | null> {
    if (!Capacitor.isPluginAvailable('Camera')) return null;
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });
      return photo.webPath ?? null;
    } catch (err) {
      if ((err as Error).message === 'User cancelled photos app') return null;
      throw err;
    }
  }
}
```

## Platform-Specific Styling

Use Ionic's mode classes, not user-agent detection:

```scss
.ios ion-toolbar { --border-width: 0; }
.md ion-toolbar { --box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
```

## Performance on Mobile

Use virtual scroll for long lists. Do not render hundreds of DOM nodes at once.

```html
<cdk-virtual-scroll-viewport itemSize="72" minBufferPx="900" maxBufferPx="1350">
  <ion-item *cdkVirtualFor="let contact of contacts">
    <ion-avatar slot="start"><img [src]="contact.avatar" loading="lazy" /></ion-avatar>
    <ion-label><h2>{{ contact.name }}</h2></ion-label>
  </ion-item>
</cdk-virtual-scroll-viewport>
```

## Building and Deploying

Always run `ionic build` before `cap sync` to ensure fresh web assets are copied.

```bash
ionic build --prod
npx cap sync
npx cap open ios    # or android
```

Configure `capacitor.config.ts` for production:

```typescript
const config: CapacitorConfig = {
  appId: 'com.example.myapp',
  appName: 'My App',
  webDir: 'www',
  server: { androidScheme: 'https' },
  plugins: { SplashScreen: { launchAutoHide: false } },
};
```

## Testing

Mock Capacitor plugins in tests to avoid native dependencies.

```typescript
it('should show fallback when camera is unavailable', async () => {
  const mockCamera = { takePhoto: jest.fn().mockResolvedValue(null) };
  await render(PhotoPage, {
    providers: [{ provide: CameraService, useValue: mockCamera }],
  });
  screen.getByText('Take Photo').click();
  expect(await screen.findByText('No photo available')).toBeTruthy();
});
```

## Common Pitfalls

Do not use `window.alert` -- use `@capacitor/dialog` for native dialogs. Do not skip `cap sync` after changing web assets. Do not use CSS `overflow: scroll` on `ion-content` children -- let `ion-content` handle scrolling because it integrates with pull-to-refresh and virtual scroll.
