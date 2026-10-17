import ContextMenuKit
import Dependencies
import WalletContext
import WalletCore

private let log = Log("MtwCardWearMenu")

@MainActor
public enum MtwCardWearMenu {
    public static func makeConfiguration(accountId: String, nft: ApiNft, source: String) -> ContextMenuConfiguration {
        @Dependency(\.accountSettings) var _accountSettings
        let accountSettings = _accountSettings.for(accountId: accountId)
        var items: [ContextMenuItem] = []
        if let mtwCardId = nft.metadata?.mtwCardId {
            let isCurrent = mtwCardId == accountSettings.backgroundNft?.metadata?.mtwCardId
            if isCurrent {
                items.append(
                    .action(
                        ContextMenuAction(
                            title: lang("Reset Card"),
                            icon: .airBundle("MenuInstallCard26"),
                            handler: {
                                log.info("cardBackground.uiReset source=\(source, .public) accountId=\(accountId, .public) nftAddress=\(nft.address, .public) nftChain=\(nft.chain.rawValue, .public) nftMtwId=\(mtwCardId)")
                                accountSettings.setBackgroundNft(nil)
                            }
                        )
                    )
                )
            } else {
                items.append(
                    .action(
                        ContextMenuAction(
                            title: lang("Install Card"),
                            icon: .airBundle("MenuInstallCard26"),
                            handler: {
                                log.info("cardBackground.uiInstall source=\(source, .public) accountId=\(accountId, .public) nftAddress=\(nft.address, .public) nftChain=\(nft.chain.rawValue, .public) nftMtwId=\(mtwCardId)")
                                accountSettings.setBackgroundNft(nft)
                                accountSettings.setAccentColorNft(nft)
                            }
                        )
                    )
                )
            }
            let isCurrentAccent = mtwCardId == accountSettings.accentColorNft?.metadata?.mtwCardId
            if isCurrentAccent {
                items.append(
                    .action(
                        ContextMenuAction(
                            title: lang("Reset Palette"),
                            icon: .airBundle("custom.paintbrush.badge.xmark"),
                            handler: {
                                accountSettings.setAccentColorNft(nil)
                            }
                        )
                    )
                )
            } else {
                items.append(
                    .action(
                        ContextMenuAction(
                            title: lang("Apply Palette"),
                            icon: .airBundle("MenuBrush26"),
                            handler: {
                                accountSettings.setAccentColorNft(nft)
                            }
                        )
                    )
                )
            }
        }
        return ContextMenuConfiguration(
            rootPage: ContextMenuPage(items: items),
            backdrop: .defaultBlurred(),
            style: ContextMenuStyle(minWidth: 180.0, maxWidth: 280.0)
        )
    }
}
