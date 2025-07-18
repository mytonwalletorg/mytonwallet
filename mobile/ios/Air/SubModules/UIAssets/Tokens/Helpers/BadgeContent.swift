//
//  BadgeHelper.swift
//  MyTonWalletAir
//
//  Created by nikstar on 24.06.2025.
//

import WalletCore
import WalletContext

public enum BadgeContent {
    case activeStaking(ApiYieldType, Double)
    case inactiveStaking(ApiYieldType, Double)
    case chain(ApiChain)
}

func badgeContent(slug: String) -> BadgeContent? {
    if slug == TONCOIN_SLUG || slug == STAKED_TON_SLUG, let apy = BalanceStore.currentAccountStakingData?.tonState?.apy {
        let hasBalance = BalanceStore.currentAccountBalances[STAKED_TON_SLUG] ?? 0 > 0
        if slug == TONCOIN_SLUG && !hasBalance {
            return .inactiveStaking(.apy, apy)
        } else if slug == STAKED_TON_SLUG && hasBalance {
            return .activeStaking(.apy, apy)
        }
    } else if slug == MYCOIN_SLUG || slug == STAKED_MYCOIN_SLUG, let apy = BalanceStore.currentAccountStakingData?.mycoinState?.apy {
        let hasBalance = BalanceStore.currentAccountBalances[STAKED_MYCOIN_SLUG] ?? 0 > 0
        if slug == MYCOIN_SLUG && !hasBalance {
            return .inactiveStaking(.apr, apy)
        } else if slug == STAKED_MYCOIN_SLUG && hasBalance {
            return .activeStaking(.apr, apy)
        }
    } else if AccountStore.account?.isMultichain == true && (slug == TON_USDT_SLUG || slug == TRON_USDT_SLUG) {
        return .chain(slug == TON_USDT_SLUG ? .ton : .tron)
    }
    return nil
}
