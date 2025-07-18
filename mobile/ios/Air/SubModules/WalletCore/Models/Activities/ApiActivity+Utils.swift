
import UIKit
import WalletContext

public struct ApiTransactionTypeTitles {
  public let complete: String
  public let inProgress: String
}

public extension ApiActivity {
    var displayTitle: ApiTransactionTypeTitles {
        switch type {
        case .stake:
            .init(complete: "Staked", inProgress: "Staking")
        case .unstake:
            .init(complete: "Unstaked", inProgress: "Unstaking")
        case .unstakeRequest:
            .init(complete: "Unstake Requested", inProgress: "Requesting Unstake")
        case .callContract:
            .init(complete: "Contract Called", inProgress: "Calling Contract")
        case .excess:
            .init(complete: "Excess", inProgress: "Excess")
        case .contractDeploy:
            .init(complete: "Contract Deployed", inProgress: "Deploying Contract")
        case .bounced:
            .init(complete: "Bounced", inProgress: "Bouncing")
        case .mint:
            .init(complete: "Minted", inProgress: "Minting")
        case .burn:
            .init(complete: "Burned", inProgress: "Burning")
        case .auctionBid:
            .init(complete: "NFT Auction Bid", inProgress: "Bidding at NFT Auction")
        case .nftTrade:
            .init(complete: "NFT Bought", inProgress: "Buying NFT")
        case .nftPurchase:
            .init(complete: "NFT Bought", inProgress: "Buying NFT")
        case .dnsChangeAddress:
            .init(complete: "Address Updated", inProgress: "Updating Address")
        case .dnsChangeSite:
            .init(complete: "Site Updated", inProgress: "Updating Site")
        case .dnsChangeSubdomains:
            .init(complete: "Subdomains Updated", inProgress: "Updating Subdomains")
        case .dnsChangeStorage:
            .init(complete: "Storage Updated", inProgress: "Updating Storage")
        case .dnsDelete:
            .init(complete: "Domain Record Deleted", inProgress: "Deleting Domain Record")
        case .dnsRenew:
            .init(complete: "Domain Renewed", inProgress: "Renewing Domain")
        case .liquidityDeposit:
            .init(complete: "Liquidity Provided", inProgress: "Providing Liquidity")
        case .liquidityWithdraw:
            .init(complete: "Liquidity Withdrawn", inProgress: "Withdrawing Liquidity")

        case .nftReceived:
            .init(complete: WStrings.Home_ReceivedNFT.localized, inProgress: WStrings.Home_ReceivedNFT.localized)
        case .nftTransferred:
            .init(complete: WStrings.Home_SentNFT.localized, inProgress: WStrings.Home_Sending.localized)
        case .swap:
            .init(complete: "Swapped", inProgress: "Swap")
        case nil:
            if transaction?.nft != nil {
                if transaction?.isIncoming == true {
                    .init(complete: WStrings.Home_ReceivedNFT.localized, inProgress: WStrings.Home_ReceivedNFT.localized)
                } else {
                    .init(complete: WStrings.Home_SentNFT.localized, inProgress: WStrings.Home_Sending.localized)
                }
            } else {
                if transaction?.isIncoming == true {
                    .init(complete: WStrings.Home_Received.localized, inProgress: WStrings.Home_Received.localized)
                } else {
                    .init(complete: WStrings.Home_Sent.localized, inProgress: WStrings.Home_Sending.localized)
                }
            }
        }
    }
    
    var displayTitleResolved: String {
        let displayTitle = self.displayTitle
        let isPending = isLocal || swap?.status == .expired || swap?.status == .failed || swap?.status == .pending
        return isPending ? displayTitle.inProgress : displayTitle.complete
    }
}

public extension ApiActivity {
    
    var isStakingTransaction: Bool {
        switch type {
        case .stake, .unstake, .unstakeRequest:
            return true
        default:
            return false
        }
    }
    
    var isDnsOperation: Bool {
        switch type {
        case .dnsChangeAddress, .dnsChangeSite, .dnsChangeStorage, .dnsChangeSubdomains, .dnsDelete, .dnsRenew:
            return true
        default:
            return false
        }
    }
}
 

public extension ApiActivity {
    var avatarContent: AvatarContent {
        let icon: String = switch self.type {
        case .stake, .unstake, .unstakeRequest:
            "ActionStake"
        case .nftReceived:
            "ActionReceive"
        case .nftTransferred:
            "ActionSend"
        case .callContract:
            "ActionContract"
        case .excess:
            "ActionReceive"
        case .contractDeploy:
            "ActionContract"
        case .bounced:
            "ActionReceive"
        case .mint:
            "ActionMint"
        case .burn:
            "ActionBurn"
        case .auctionBid:
            "ActionAuctionBid"
        case .nftTrade:
            "ActionNftBought"
        case .nftPurchase:
            "ActionNftBought"
        case .dnsChangeAddress, .dnsChangeSite, .dnsChangeSubdomains, .dnsChangeStorage, .dnsDelete, .dnsRenew:
            "ActionSiteTon"
        case .liquidityDeposit:
            "ActionProvidedLiquidity"
        case .liquidityWithdraw:
            "ActionWithdrawnLiquidity"
        case .swap:
            "ActionSwap"
        case nil:
            transaction?.isIncoming == true ? "ActionReceive" : "ActionSend"
        }
        return .image(icon)
    }
    
    private var green: [CGColor] { WColors.greenGradient }
    private var red: [CGColor] { WColors.redGradient }
    private var gray: [CGColor] { WColors.grayGradient }
    private var blue: [CGColor] { WColors.blueGradient }
    private var indigo: [CGColor] { WColors.indigoGradient }
    
    var iconColors: [CGColor] {
        let colors: [CGColor] = switch self.type {
        case .stake:
            indigo
        case .unstake:
            green
        case .unstakeRequest:
            blue
        case .nftReceived:
            green
        case .nftTransferred:
            blue
        case .callContract:
            gray
        case .excess:
            green
        case .contractDeploy:
            gray
        case .bounced:
            red
        case .mint:
            green
        case .burn:
            red
        case .auctionBid:
            blue
        case .nftTrade:
            blue
        case .nftPurchase:
            blue
        case .dnsChangeAddress, .dnsChangeSite, .dnsChangeSubdomains, .dnsChangeStorage, .dnsDelete, .dnsRenew:
            gray
        case .liquidityDeposit:
            blue
        case .liquidityWithdraw:
            green
        case .swap:
            if case .swap(let swap) = self {
                if swap.cex?.status == .hold {
                    gray
                } else if swap.status == .expired || swap.status == .failed {
                    red
                } else {
                    blue
                }
            } else {
                blue
            }
        case nil:
            transaction?.isIncoming == true ? green : blue
        }
        return colors
    }
    
    var addressToShow: String {
        return transaction?.metadata?.name ?? (transaction?.isIncoming == true ? transaction?.fromAddress : transaction?.toAddress) ?? " "
    }
}


public extension ApiActivity {
    func shouldIncludeForSlug(_ tokenSlug: String?) -> Bool {
        if let tokenSlug {
            return switch self {
            case .transaction(let tx):
                tx.slug == tokenSlug
            case .swap(let swap):
                swap.to == tokenSlug || swap.from == tokenSlug
            }
        } else {
            return true
        }
    }
    
    func matches(newActivity: ApiActivity) -> Bool {
        if self.txId?.replacingOccurrences(of: "|", with: "") == newActivity.txId {
            return true
        }
        if self.transaction?.normalizedAddress == newActivity.transaction?.normalizedAddress {
            if self.slug == "toncoin" && self.transaction?.externalMsgHash == newActivity.transaction?.externalMsgHash {
                return true
            }
            if !(self.transaction?.isIncoming == true) && self.slug == newActivity.slug && self.transaction?.amount == newActivity.transaction?.amount && self.timestamp <= newActivity.timestamp {
                return true
            }
        }
        return false
    }
}


public extension ApiActivity {
    
    var isTinyOrScamTransaction: Bool {
        if isScamTransaction {
            return true
        }
        switch self {
        case .transaction(let transaction):
            if type != nil || transaction.nft != nil {
                return false
            }
            guard let token = TokenStore.tokens[slug] else {
                return false
            }
            if token.isPricelessToken {
                return false
            }
            return abs(bigIntToDouble(amount: transaction.amount, decimals: token.decimals)) * (token.priceUsd ?? 0) < TINY_TRANSFER_MAX_COST
        case .swap:
            return false
        }
    }
    
    var isScamTransaction: Bool {
        return transaction?.metadata?.isScam == true // TODO: ||  getIsTransactionWithPoisoning(transaction))
    }

    var shouldShowTransactionComment: Bool {
        return !isStakingTransaction && !isScamTransaction
    }

    enum AmountDisplayMode {
        case hide
        case noSign
        case normal
        case swap
    }
    var amountDisplayMode: AmountDisplayMode {
        switch self {
        case .transaction(let tx):
            let isPlainTransfer = type == nil && tx.nft == nil
            if !isPlainTransfer && tx.amount == 0 {
                return .hide
            } else if type == .stake || type == .unstake {
                return .noSign
            } else {
                return .normal
            }
        case .swap:
            return .swap
        }
    }

    var shouldShowTransactionAddress: Bool {
        if case .transaction(let transaction) = self {
            let shouldHide = isOurStakingTransaction
                || type == .burn
                || type == .nftPurchase
                || type == .nftTrade
                || (!transaction.isIncoming && transaction.nft != nil && transaction.toAddress == transaction.nft?.address)
                || (transaction.isIncoming && type == .excess && transaction.fromAddress == BURN_ADDRESS)

          return !shouldHide;
        }
        return false
    }
    
    /** "Our" is staking that can be controlled with MyTonWallet app */
    var isOurStakingTransaction: Bool {
        if case .transaction(let tx) = self {
            return isStakingTransaction && ALL_STAKING_POOLS.contains(tx.isIncoming ? tx.fromAddress : tx.toAddress ?? "")
        }
        return false
    }

    var shouldShowTransactionAnnualYield: Bool {
        return type == .stake && isOurStakingTransaction
    }
    
    var timestampDate: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000)
    }
}
