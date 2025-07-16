
import SwiftUI
import UIKit
import UIComponents
import WalletContext
import WalletCore


struct NftFullscreenPreview: View {

    @ObservedObject var viewModel: NftDetailsViewModel
    
    var nft: ApiNft { viewModel.nft }
        
    var body: some View {
        ZStack {
            Color.black
            ScrollView([.horizontal, .vertical]) {
                NftImage(nft: viewModel.nft, animateIfPossible: true)
            }
        }
    }
}

