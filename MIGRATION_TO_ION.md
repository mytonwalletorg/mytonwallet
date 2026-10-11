# Migration to ION

Этот файл — рабочий план превращения MyTonWallet в ION Wallet. Он фиксирует согласованный объём миграции, фактический статус и блокеры. Внешние ссылки, store/registry-записи и графические материалы ведутся отдельно в [реестре ресурсов](REBRANDING_RESOURCE_REGISTRY.md). Обновляем оба файла после каждого законченного блока работы.

## Цель

Выпустить ION Wallet на базе MyTonWallet для сети ION (TON-совместимая сеть) и ION в BNB Chain. Оставляем Capacitor-приложения для Android и iOS, а также web, расширение браузера и Electron. Ненужные продукты, сети, бренды и инфраструктурные зависимости удаляем.

## Текущее состояние

Рабочая ветка фиксируется в текущем PR. Статус обновляется вместе с каждым блоком миграции.

| Область | Статус | Что сделано |
| --- | --- | --- |
| Capacitor | ✅ | Восстановлены мобильные Android/iOS-обёртки Capacitor. Старое нативное Air-приложение удалено. |
| Лишние продукты | ◐ | Удалены Portfolio, включая token net worth graph и его backend endpoint, а также POST-запрос ассетов и экран расширенной информации токена; Multisend, MyCoin и его vesting, nominator staking, покупка и продажа за банковские карты. Giveaway и модуль My Wallet Cards удалены; обычные карточки аккаунтов и палитры остаются. |
| Сети | ✅ | Удалены Tron и Solana. Из EVM оставлена только BNB Chain; из токенов BNB оставлен только ION. |
| Бренды и Explorer | ◐ | Удалены Gram Wallet и его iOS widget extension. Переименованы web/npm, Android и iOS targets, desktop-артефакты, package IDs, ION Gateway/EIP-6963 identifiers и основные deep link-схемы в ION Wallet. |
| История релизов и CI | ✅ | Удалены changelogs и неактуальные build/deploy-пайплайны. |
| ION API и инфраструктура | ◐ | Runtime URL переведены на `wallet.ice.io`; в предпросмотре подключён ION RPC v2. Полноценного совместимого v3 indexer пока нет. Firebase использует безопасную заглушку до получения настоящих ключей. |
| Agent | ✅ | Удалены оставшиеся ключи storage и локализаций, CI-задачи, иконки, анимации, CSS и комментарии. |
| iOS-проект | ✅ | Удалены Air-only targets, Gram Wallet и widget extension; рабочие схемы — `IONWallet`, `IONWallet_NoExtensions`, `IONWallet_Preview`. `pod install`, `cap sync ios` и сборка всех трёх схем для generic iOS Simulator проходят. |

## Решения, которые уже приняты

- Поддерживаем только ION/TON и BNB Chain.
- Нативный Air не возвращаем. Мобильные приложения работают через Capacitor.
- Механизм миграций хранилища сохраняем, но проектные миграционные шаги не переносим.
- Кастомизация кошелька без NFT Cards может остаться; My Wallet Cards и их minting удаляем полностью.
- Token staking и liquid staking сохраняем; nominator staking — нет.
- ION должен быть доступен как нативный актив сети ION и как единственный поддерживаемый ION-токен в BNB Chain.

## Открытая работа

### P0 — необходимое до первого рабочего релиза

- [x] **Удалить MFA / Telegram 2FA.**
  - Удалены отдельная сборка, npm-команды, экран настроек, ассеты, контракты, сетевые обращения, состояния интерфейса, локализации и каталог `src/mfa`.
  - Обычные пароль/PIN, биометрия и аппаратные кошельки сохраняются.

- [x] **Удалить Telegram Mini App.**
  - Удалены отдельные сборки и CI-задача, SDK, Telegram-биометрия, полноэкранный режим, haptics, элементы интерфейса Mini App и специальная поддержка Telegram Gifts.
  - Удалены продуктовые ссылки на Telegram support, news и tips; антифишинговая проверка внешних `t.me` ссылок сохранена.

- [x] **Удалить gasless / Diesel.**
  - Удалены расчёт и оплата комиссий Diesel, backend-вызовы, платёжный шлюз и варианты интерфейса для переводов и свапов.

- [x] **Удалить legacy swap и подготовить ION Exchange.**
  - Удалены DEX/CEX swap: `/swap/*`, провайдеры, котировки, маршруты, slippage, комиссии, подпись swap-транзакций, история и reconciliation swap-активностей.
  - Оставлена только оболочка окна **Exchange** с фиксированной парой `ION (ION Network) → ION (BNB Chain)`; она не создаёт транзакцию.
  - После утверждения bridge-контракта, получателя и модели комиссии реализовать внутри этой оболочки обычный перевод ION на bridge-адрес и обработку его статуса (P1).

- [x] **Завершить удаление Agent.**
  - Удалены продуктовые строки и storage keys Agent, CI-проверки и Chromium e2e-задача, иконки, анимации, CSS-классы и конфигурационные упоминания.
  - Нейтральные упоминания браузерного `userAgent` и стороннего dApp `agents.ton.org` сохранены: они не включают функциональность Agent.
  - Критерий выполнен: в пользовательском интерфейсе, сборках и CI Agent больше не существует.

- [x] **Удалить My Wallet Cards.**
  - Удалены NFT collection, minting, CDN, кастомные NFT-фоны, меню, локализации и неиспользуемые ассеты Cards. Старые значения в storage очищаются миграцией.
  - Обычные карточки аккаунтов, темы и палитры сохранены; палитры больше не требуют NFT Cards.

- [x] **Проверить Giveaway.**
  - Поиск по `src`, `mobile` и `public` не находит оставшегося Giveaway-кода; `app_giveaway_url` удалён из Android ресурсов.

- [x] **Удалить TON-специфичные интеграции Fragment, Notcoin vouchers и Ethena.**
  - Удалены Fragment collections, NFT-меню, marketplace-метаданные и тестовые trace fixtures; Notcoin voucher exchange/burn flow; Ethena USDe/tsUSDe staking, контракты, backend-модели, activity parsing, интерфейс и локализации.
  - Обычные NFT, общий burn NFT, liquid staking и jetton staking сохранены.

- [x] **Проверить сборку iOS Capacitor-проекта.**
  - Удалены Air package products, `AirWidgetExtension`, Air-only target и ссылки на удалённые файлы.
  - Workspace разрешает зависимости; после `cap sync ios` собраны `IONWallet`, `IONWallet_NoExtensions` и `IONWallet_Preview` для generic iOS Simulator с отключённым code signing.
  - Запуск на симуляторе или устройстве остаётся ручной проверкой из P2.

- [ ] **Закрыть вопрос с ION activity API.**
  - ION RPC v2 отвечает на JSON-RPC вызовы и подходит для базовых операций.
  - Кошелёк использует v3 indexer для истории, pending activities и части данных об аккаунте.
  - Нужен совместимый ION v3 endpoint либо отдельная адаптация слоя активности. Подмена nginx не решает проблему.

- [ ] **Убрать зависимость preview от MyTonWallet backend.**
  - ✅ `GET /assets` перенесён в ION backend. Slug токена теперь `<chain>-<полный канонический адрес>` (EIP-55 для BNB, bounceable для ION) вместо 10 символов в нижнем регистре: обрезанный slug позволял поддельному токену совпасть с настоящим.
  - Полный список endpoint-ов, которые клиент ждёт от ION backend: [ION_BACKEND_API.md](ION_BACKEND_API.md).
  - На 2026-09-29 `api.wallet.ice.io` не резолвится из среды сборки; fallback в `BRILLIANT_API_BASE_URL` и `PROXY_API_BASE_URL` нельзя считать работающей ION-инфраструктурой.
  - Утвердить ION endpoint либо осознанно убрать зависимые функции, сгруппированные по назначению:
    - кошелёк и безопасность: `GET /assets`, `/currency-rates`, `/known-addresses`, `/utils/get-config`;
    - каталог и рынок: `/v2/dapp/catalog`, `/prices/chart/*`;
    - legacy swap: `/swap/*`, DEX/CEX маршрутизация и история swap удаляются; будущий ION bridge не использует эти endpoint-ы;
    - staking и DNS: `/staking/*`, `/dns/getDomains` — требуют утверждённых ION контрактов и indexer;
    - уведомления и live-обновления: `/notifications/*`, WebSocket `/{testnet/}ws`;
    - proxy: `/proxy/download-json` и `/proxy/download-lottie` для внешних метаданных и анимаций.
  - После решения проверить, что все runtime запросы к backend идут к утверждённому ION-сервису, а не к MyTonWallet; сами GitHub forks в `package.json` остаются закреплёнными исходниками зависимостей до появления ION forks.

- [ ] **Принять решение по каждому оставшемуся полю `/utils/get-config`.**
  - `isLimited` и `country`: нужны только для региональных ограничений iOS/Android; утвердить источник и правила ION или удалить ограничение.
  - `isCopyStorageEnabled`: разрешает экспорт диагностических данных; определить, нужен ли он в production и чем управляется.
  - `now`: используется для предупреждения о неверном времени устройства; сохранить через ION time endpoint либо заменить локальной проверкой.
  - `isUpdateRequired`: обязательное обновление клиента; определить источник версии для App Store, Google Play и desktop.
  - `isWebSocketEnabled`: сейчас не читается клиентом; удалить из контрактной схемы после решения, нужны ли live-обновления.
  - Уже удалены без замены: `seasonalTheme`, `isNegVerdictCacheEnabled`, `isTonConnectAnalyticsEnabled`, `supportAccountsCount`, `knowledgeBaseVersion`, `isVestingEnabled`, `/account-config`, `/referrer/get`, `/attribution/claim`, `/nfts/report`, promotion UI, сезонные ресурсы, install attribution, NFT reporting, negative-verdict cache и TonConnect telemetry.

### P1 — подготовка продукта к ребрендингу и выпуску

- [x] Переименовать основные пакеты, артефакты и нативные цели в **ION Wallet**.
  - npm package: `ion-wallet`; Capacitor app ID: `io.ice.wallet`; Android flavor: `ionwallet`; iOS schemes: `IONWallet*`.
  - Desktop-артефакты: `IONWallet-*`; Android direct APK: `IONWallet.apk`.
  - Удалён iOS target и ресурсы Gram Wallet, включая widget extension.
  - Android production-сборка проверена командой `:app:assembleIonwalletProdDebug`.
- [x] Заменить локальные схемы `ton://` и `mtw://` на `ion://`.
  - Для собственного ION Gateway-канала используется `ion-gateway://`. Стандартный входящий URI ION Gateway `tc://` сохранён для совместимости с официальным SDK; public links используют `wallet.ice.io`.
- [x] Сохранить отдельный Capacitor WebView origin `https://ionwallet.local`.
  - Это технический локальный origin native-обёртки; он не заменяет публичные Universal Links и App Links на `wallet.ice.io`.
- [x] Удалить перенос legacy auth в Enclave.
  - ION Wallet создаётся сразу с Enclave: старые encrypted mnemonic, legacy biometric storage, rollback и recovery UI не поддерживаются.
- [ ] Завершить внешнюю инфраструктуру и публикацию. См. [реестр ресурсов](REBRANDING_RESOURCE_REGISTRY.md).
  - Текущие `wallet.ice.io` URL — временные кодовые значения, а не доказательство готового сайта, API, help-центра, legal-страниц, загрузок или CDN. Для каждого нужен опубликованный ресурс или удаление ссылки.
  - Перед Android-релизом утвердить и заменить либо удалить все публичные ссылки из `mobile/android/app/src/ionwallet/res/values/strings.xml`: website, blog, terms, privacy policy, share/install, help и help/scam, desktop download и direct APK. Они сейчас указывают на временные `wallet.ice.io` и `help.wallet.ice.io`.
  - Перед Android-релизом установить настоящий `mobile/android/app/src/ionwallet/google-services.json` из ION Firebase Console и проверить соответствие `io.ice.wallet`, release signing certificate и Firebase-проекту ION Wallet.
  - Firebase-конфигурация заменена на нерабочую ION-заглушку: Android собирается, а iOS не вызывает `FirebaseApp.configure()` до установки настоящего `GOOGLE_APP_ID`. Перед выпуском нужны конфиги из ION Firebase Console.
  - Зарегистрировать и проверить ION Wallet в ION Connect и WalletConnect, включая metadata, package IDs, deep links, icon и policy URL.
  - Создать и оформить App Store Connect и Google Play Console приложения: signing, privacy/data disclosure, store listing, screenshots, support/policy URLs и тестовые каналы.
  - Опубликовать доменные association-файлы (`apple-app-site-association`, `assetlinks.json`) и рабочие ION backend endpoint-ы.
  - GitHub forks и npm scopes старого проекта пока сохранены только как закреплённые источники зависимостей; их нельзя переименовывать, пока не созданы эквивалентные ION forks.
- [ ] Утвердить и заменить все иконки, logo, splash и store assets по [реестру ресурсов](REBRANDING_RESOURCE_REGISTRY.md).
- [ ] Поддерживать README без унаследованных непроверенных маркетинговых заявлений; добавить публичные ссылки только после их публикации.
- [ ] Утвердить bridge-путь ION между ION Network и BNB Chain.
  - Зафиксировать контракт/адрес получателя, сеть-источник и сеть-назначение, правила amount/fee и подтверждения.
  - После этого включить создание обычной bridge-транзакции в сохранённом окне Exchange.
- [ ] Подготовить Electron publish-конфигурацию к выпуску.
  - В `src/electron/config.yml` установить generic publish URL `https://s3.wallet.ice.io/public/desktop-beta` и versioned artifact name `IONWallet-${version}-${arch}.${ext}`.
  - Одновременно сверить update feed, `package-and-publish.yml` и публичную desktop download-страницу, чтобы имена файлов и URL совпадали.
- [ ] Заменить `TON_DNS_ZONES` на единственную утверждённую ION DNS-зону.
  - Получить suffix, resolver, название коллекции и правила renewal/linking для ION DNS, затем убрать TON-специфичные зоны из `src/config.ts`.
  - Проверить валидацию доменов, receive/send, NFT metadata и экран управления доменом с новой зоной.
- [ ] Проверить все жёстко заданные TON-адреса, token slug'и и идентификаторы коллекций.
  - Для каждого runtime-значения подтвердить ION-аналог; если аналога нет, удалить связанную функцию либо временно отключить её безопасной заглушкой до получения утверждённого значения.
  - ✅ `STON_PTON_ADDRESS`/`STON_PTON_SLUG` удалены вместе со специальной веткой; USDT (TON и BNB) удалён из конфигурации, scam-эвристики, выбора токена и комиссий.
  - Осталось: `LIQUID_JETTON`/`STAKED_TON_SLUG` (stTON MyTonWallet), FIVA-хэши в `PRICELESS_TOKEN_HASHES`, контракты `PushEscrow*`.
  - Отдельно отличать такие runtime-константы от тестовых fixtures: фикстуры сохраняются только там, где проверяют поддерживаемую ION-функцию.
- [ ] Завершить переход публичного моста с TON Connect на ION Gateway после утверждения схемы и регистрации протокола.
  - Сейчас extension публикует один мост под `window.ionwallet.ionconnect` и временным совместимым alias `window.ionwallet.tonconnect`.
  - После фикса окончательных URI-схем, manifest/registry-записей и требований ION Gateway заменить или удалить legacy alias, старые bridge identifiers и пользовательские упоминания TON Connect.
- [ ] Снять `NO_WEBSOCKET`, когда ION начнёт отдавать update-сокет.
  - Пока сборки используют HTTP polling вместо Toncenter, EVM и backend WebSocket.
- [ ] Пересмотреть CI после удаления Agent: оставить только проверки актуальных web и Capacitor целей.
- [ ] Закоммитить и перенести в репозиторий nginx-конфигурацию предпросмотра `wallet.lab.windbit.dev`, если она остаётся частью инфраструктуры проекта.

### P2 — проверка перед выпуском

- [ ] TypeScript, ESLint, Stylelint, Jest и production webpack build.
- [ ] Web: создание и импорт кошелька, receive, send, Exchange shell, staking, история, токены и ION Gateway.
- [ ] Extension и Electron: запуск и основные пользовательские сценарии.
- [ ] Android Capacitor: `cap sync`, сборка, запуск, биометрия, QR, ссылки и уведомления.
- [ ] iOS Capacitor: `cap sync`, Xcode build, запуск, биометрия, QR, ссылки и уведомления.
- [ ] Ручная проверка с ION RPC и BNB Chain без обращений к удалённым сетям и продуктам MyTonWallet.

## Известные технические факты

- Предпросмотр на Home Lab уже умеет проксировать ION RPC v2. В нём также устранены утечка basic-auth заголовка в upstream и ошибочный SPA fallback для отсутствующих API.
- У ION пока нет совместимого v3 indexer. Без решения этого вопроса история операций не может считаться готовой.
- Android: `:app:assembleIonwalletProdDebug` проходит с Firebase-заглушкой. iOS: `cap sync ios --deployment`, `pod install` и Xcode-сборка всех рабочих схем проходят; запуск требует совместимого iOS runtime или подключённого устройства.
- В текущем checkout нет файла `AGENTS.md`. Запрошенная зачистка Agent относится к остаткам функциональности в коде и CI, перечисленным выше.

## Как обновлять план

После завершения пункта отмечаем его галочкой, добавляем ссылку на коммит и коротко фиксируем проверку. Если появляется новый блокер или решение меняет объём работы, сначала обновляем этот файл, затем код.
