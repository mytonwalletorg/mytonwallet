# Реестр ресурсов для ребрендинга ION Wallet

Этот файл — источник правды для внешних ресурсов, которые нельзя считать готовыми только потому, что в коде уже стоит `wallet.ice.io` или `ION Wallet`.

Статусы:

- **требует решения** — владелец продукта должен дать конечное значение или подтвердить удаление;
- **требует регистрации** — ресурс создаётся во внешней системе;
- **требует дизайна и проверки** — файл существует, но его визуальная принадлежность ION не подтверждена;
- **удаляется** — остаток закрытого продукта;
- **готово в коде** — кодовая привязка сделана, но внешняя публикация может ещё отсутствовать.

## Внешние URL и сервисы

| Ресурс | Места в репозитории | Статус | До релиза |
| --- | --- | --- | --- |
| Основной сайт, blog, terms, privacy | `mobile/android/app/src/ionwallet/res/values/strings.xml`, `src/config.ts`, webpack-конфигурации | требует решения | Поднять и проверить каждую страницу либо убрать ссылку из интерфейса. Нельзя оставлять маршрут-заглушку. |
| Help Center и anti-scam статьи | Android `strings.xml`, ссылки интерфейса | требует решения | Опубликовать ION-версии help-центра, включая EN/RU anti-scam статьи, либо заменить безопасным актуальным ресурсом. |
| Загрузка Android/desktop и `IONWallet.apk` | Android `strings.xml`, Electron/webpack URL | требует решения | Настроить подписанные артефакты, загрузку, обновления и проверить ссылки с чистого устройства. |
| Runtime API, RPC, indexer, static CDN, ION Gateway bridge | `src/config.ts`, `webpack.config.ts` | требует решения | Для каждого endpoint определить владельца, production URL, мониторинг и контракт. Отдельно закрыть отсутствие ION-совместимого v3 indexer. Текущий legacy bridge URL с именем `tonconnectbridge` заменить только после provisioned ION Gateway endpoint и интеграционной проверки. |
| Universal Links / App Links | `mobile/ios/App/Entitlements/IONWallet*.entitlements`, `mobile/android/app/src/ionwallet/AndroidManifest.xml` | требует регистрации | Опубликовать `apple-app-site-association` и `assetlinks.json` на `wallet.ice.io`, `connect.wallet.ice.io`, `go.wallet.ice.io`; в файлах указать реальные App ID, signing certificate SHA-256 и пути. |
| Firebase | Android `google-services.json`, iOS `GoogleService-Info.plist` | требует регистрации | Создать production-проекты ION в Firebase Console, добавить Android `io.ice.wallet` и iOS bundle IDs, включить нужные сервисы и заменить текущие безопасные заглушки. |
| ION Gateway registry | manifest / metadata кошелька и реестр ION Gateway | требует регистрации | Создать официальный wallet entry: название, `ion://`/`ion-gateway://`, сайт, иконки, ссылки на store и технический контакт. Подтвердить регистрацию и совместимость со стандартным входящим URI ION Gateway `tc://`; проверить подключение dApp после публикации. |
| WalletConnect Explorer/registry | WalletConnect project configuration и metadata | требует регистрации | Создать production project ID, зарегистрировать ION Wallet с точным package ID, deep links, redirect URLs, иконками и privacy policy. Не использовать тестовый проект в релизе. |
| App Store Connect | iOS target, signing, App Store listing | требует регистрации | Зарегистрировать приложение и bundle ID, настроить certificates/profiles, privacy labels, возрастной рейтинг, support/privacy URL, скриншоты, локализации и TestFlight. |
| Google Play Console | Android flavor `ionwallet`, signing, listing | требует регистрации | Создать приложение, загрузить подписанный AAB, настроить Play App Signing, Data safety, content rating, privacy policy, контакты, скриншоты и closed testing. |
| Desktop signing and update feed | Electron builder/updater config, `public/icon-electron-*` | требует решения | Завести сертификаты/notarization, update endpoint и проверяемый канал обновлений для macOS/Windows/Linux. |
| README и публичная документация | `README.md`, `docs/` | готово в коде / требует развития | README очищен от неподтверждённых заявлений старого продукта; перед публикацией добавить подтверждённые ссылки на сайт, stores, help, policy и инструкции поддержки. |

`app_cards_url` и `app_giveaway_url` уже удалены из актуального Android `strings.xml`. Их не возвращать: Cards и Giveaway относятся к удаляемым функциям.

## Визуальные и брендовые ресурсы

Все позиции ниже требуют просмотра дизайнером или владельцем бренда на светлой/тёмной теме и на реальных устройствах. Имя файла не доказывает, что внутри нет старого логотипа.

| Набор | Исходные файлы | Статус | Действие |
| --- | --- | --- | --- |
| Web/PWA logo и favicon | `public/logo.svg`, `public/icon.png`, `public/icon-*.png`, `public/apple-touch-icon.png`, `public/favicon.ico`, `public/mstile-150x150.png` | требует дизайна и проверки | Утвердить ION знак и экспортировать полный набор размеров; проверить manifest, браузер, вкладку и install prompt. |
| Web-интерфейс | `src/assets/logo.svg`, `src/assets/logo.webp`, `src/assets/logoLight.svg`, `src/assets/logoMinimalistic.svg`, `public/assets/ui/qr-logo.png` | требует дизайна и проверки | Заменить все варианты, проверить splash, QR и темы. |
| Electron | `public/icon-electron-macos.icns`, `public/icon-electron-macos.png`, `public/icon-electron-windows.ico` | требует дизайна и проверки | Подготовить подписываемые иконки для каждой платформы и проверить метаданные артефактов. |
| Android launcher, splash, notification | `mobile/android/app/src/ionwallet/res/mipmap-*`, `drawable-*/ic_default_notification.png`, `ic_splash_foreground.webp`, `img_logo_src.webp` | требует дизайна и проверки | Переэкспортировать ION-версии, проверить adaptive icon, splash и notification на Android. |
| iOS app icon и intro | `mobile/ios/App/App/Resources/IONWallet/AppIcon.icon`, `Assets.xcassets/AppIcon.appiconset`, `Assets.xcassets/IntroLogo.imageset` | требует дизайна и проверки | Подготовить полный набор App Store icon и launch/intro assets; проверить на iPhone/iPad и в App Store Connect. |
| Нативные копии web assets | `mobile/android/app/src/main/assets/public`, `mobile/ios/App/App/public` | производные файлы | Не редактировать вручную: обновлять `public/`, затем проверять результат `cap sync`. |
| TON-партнёрские marks | `public/logo-ton-app.svg`, `public/logo-ton-org.svg` | требует решения | Оставить только при наличии согласованного основания и актуальных brand guidelines; иначе удалить ссылки/файлы. |
| Старые Cards assets | `src/assets/cards/**`, `src/assets/settings/settings_mw-cards.svg` | удаляется | Удалить вместе с остатками My Wallet Cards; они не являются ресурсами нового бренда. |
| Product-specific illustrations | `src/assets/lottiePreview/**`, `src/assets/blockchain/**`, `src/assets/theme/**` | требует дизайна и проверки | Проверить на старый знак, устаревшие сети и удалённые продукты; сохранить только нужное ION/BNB покрытие. |

## Повторяемая проверка

Перед каждым релизом:

1. Просмотреть все строки `wallet.ice.io` и каждый URL в пользовательском интерфейсе; для каждого должно быть опубликованное назначение и владелец.
2. Открыть приложение на web, Android, iOS, extension и Electron и проверить logo, icon, splash, QR, deep links и внешние переходы.
3. Выполнить поиск `mytonwallet`, `my wallet`, `gram`, `mtw`, `giveaway` и список отключённых продуктов. Совпадения в закреплённых зависимостях и тестовых данных оформлять отдельно с обоснованием.
4. Сверить store/registry metadata с package IDs: `io.ice.wallet`, iOS IONWallet targets, `ion://`, `ion-gateway://`, `ion-wc://` и стандартным URI ION Gateway `tc://`.
