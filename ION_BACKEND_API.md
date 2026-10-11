# ION Backend API — контракт для клиента

Здесь перечислено всё, что клиент ION Wallet ожидает от бэкенда после удаления лишних продуктов (см. [план миграции](MIGRATION_TO_ION.md)). Список собран по фактическим вызовам в коде. Базовые URL задаются в `src/config.ts`: `BRILLIANT_API_BASE_URL`, `PROXY_API_BASE_URL`, `TONCENTER_*_URL`, `EVM_*_RPC_URL`.

Общие заголовки каждого запроса (`src/api/common/backend.ts`): `X-App-ClientID`, `X-App-Version`, `X-App-Env`, `X-App-Name`; для авторизованных POST — `X-Auth-Token`.

Приоритет: **P0** — без него кошелёк не работает; **P1** — нужно к релизу; **P2** — можно заглушить или убрать.

## 1. ION Wallet backend (`BRILLIANT_API_BASE_URL`)

| Приоритет | Endpoint | Где в клиенте | Что отдаёт / зачем |
| --- | --- | --- | --- |
| ✅ P0 | `GET /assets?langCode=` | `api/common/tokens.ts` | Готово в ION backend: три токена закреплены в коде (ION, BNB, ION в BNB), цены и изменение за 24 ч из CoinGecko раз в 2 минуты; до первой загрузки запрос ждёт цены. `langCode` игнорируется. |
| ✅ P0 | `GET /currency-rates` | `methods/polling.ts` | Готово в ION backend: `{ rates }` — единиц USD, EUR, RUB, CNY, BTC и ION (ключ `TON`) за 1 USD. Фиат и BTC из CoinGecko `exchange_rates` раз в 10 минут, ION — `1 / priceUsd` из `/assets`. До первой загрузки запрос ждёт данные. |
| P0 | `GET /utils/get-config` | `methods/polling.ts` | `isLimited`, `country`, `now`, `isUpdateRequired`, `isCopyStorageEnabled`, `isWebSocketEnabled`. Решение по каждому полю — в плане миграции. |
| ✅ P0 | `GET /known-addresses` | `api/common/addresses.ts` | Готово в ION backend: `knownAddresses` из [catchain/ion-address-book](https://github.com/catchain/ion-address-book) раз в час, `scamMarkers`, `trustedSites` (домены `ice.io`), `trustedCollections` (пусто). Антифишинг и подписи адресов. |
| P1 | `GET /staking/common` | `chains/ton/staking.ts` | `liquid` (rate, apy, available, tvl, totalStakers, loyaltyApy), `round`/`prevRound`, `jettonPools`. |
| P1 | `GET /staking/state/{address}?isViewMode=1` | `chains/ton/staking.ts` | `balance`, `totalProfit`, `loyaltyBalance` и состояние стейкинга адреса. |
| P1 | `GET /staking/profits/{address}` | `methods/staking.ts` | История начислений. |
| P1 | `GET /prices/chart/{assetId}` | `methods/prices.ts` | График цены токена. |
| P1 | `POST /notifications/subscribe`, `POST /notifications/unsubscribe` | `methods/notifications.ts` | Push-подписки (нужен ION Firebase). |
| P2 | `GET /dns/getDomains?address=` | `chains/ton/domains.ts` | Домены адреса; зависит от ION DNS-зоны. |
| P2 | `GET /v2/dapp/catalog?isLandscape=&langCode=` | `methods/exploreSites.ts` | Каталог dApp во вкладке Explore. |
| P2 | WebSocket `/{testnet/}ws` | `api/common/backendSocket.ts` | Live-обновления; сейчас выключен через `NO_WEBSOCKET`. |

Стейкинг: поддерживаются только `liquid` и `jetton`, nominator staking удалён. Формат ответов нужно сверить с ION-бэкендом, где стейкинг уже есть: либо бэкенд отдаёт текущий контракт, либо адаптируем клиент.

## 2. Proxy (`PROXY_API_BASE_URL`)

| Приоритет | Endpoint | Зачем |
| --- | --- | --- |
| P1 | `GET /download-json?url=` | Загрузка внешних NFT/jetton метаданных без CORS. |
| P2 | `GET /download-lottie?url=` | Загрузка Lottie-анимаций. |

## 3. ION indexer (`TONCENTER_*_URL`, совместимость с Toncenter v3)

Блокер P0: без него не работают история и pending-операции. ION RPC v2 (`/api/v2`) уже есть.

| Endpoint v3 | Зачем |
| --- | --- |
| `/actions`, `/pendingActions` | История и ожидающие операции. |
| `/traces`, `/pendingTraces` | Детали операции и отслеживание отправки. |
| `/transactions`, `/messages` | Транзакции и сообщения. |
| `/accountStates`, `/walletStates` | Состояние аккаунтов и кошельков. |
| `/addressBook`, `/metadata` | Человекочитаемые адреса и метаданные. |
| `/jetton/wallets` | Балансы jetton'ов. |
| `/nft/items`, `/nft/transfers` | NFT и их история. |

## 4. BNB Chain (`EVM_*_RPC_URL`)

| Endpoint | Сейчас | Зачем |
| --- | --- | --- |
| `/{chain}/v2` (JSON-RPC) | RPC-нода | Отправка транзакций, газ, nonce. |
| `/v1/wallets/{address}/positions/` | Zerion | Балансы. Клиенту нужен только ION в BNB. |
| `/v1/wallets/{address}/transactions/` | Zerion | История. |
| `/nft/v3/getNFTsForOwner`, `/nft/v3/getNFTMetadata` | Alchemy-совместимый | NFT; можно убрать, если NFT на BNB не нужны. |

Обсуждали замену Zerion: Alchemy (≈$8–10/мес при 30k DAU) или Moralis (≈$397/мес). Прокси за нашим бэкендом с тем же контрактом позволит менять провайдера без правок клиента.

## 5. Будущее

- ION bridge (Exchange ION ↔ BNB): адрес bridge-контракта, комиссия, статус перевода. Контракт ещё не утверждён.
