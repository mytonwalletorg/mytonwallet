//
//  ExploreVC.swift
//  UIBrowser
//
//  Created by Sina on 6/25/24.
//

import UIKit
import UIComponents
import WalletCore
import WalletContext
import SwiftUI
import Kingfisher


struct ExploreCategoryRow: View {
    
    var site: ApiSite
    
    var openAction: () -> ()
    
    var body: some View {
        HStack(spacing: 10) {
            KFImage(URL(string: site.icon))
                .resizable()
                .loadDiskFileSynchronously(false)
                .aspectRatio(contentMode: .fill)
                .clipShape(.rect(cornerRadius: 12))
                .frame(width: 48, height: 48)
            
            VStack(alignment: .leading, spacing: 3) {
                Text(site.name)
                    .font(.system(size: 15, weight: .semibold))
                    .fixedSize()
                Text(site.description)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(WTheme.secondaryLabel))
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            Button(action: openAction) {
                HStack(spacing: 2) {
                    if site.shouldOpenExternally {
                        Image.airBundle("TelegramLogo20")
                            .padding(.leading, -4)
                            .padding(.vertical, -6)
                    }
                    Text("Open")
                }
            }
            .buttonStyle(OpenButtonStyle())
        }
    }
}

fileprivate struct OpenButtonStyle: ButtonStyle {
    @State private var isHighlighted: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .opacity(isHighlighted ? 0.5 : 1)
            .foregroundStyle(Color(WTheme.tint))
            .background(Color(WTheme.tint), in: .containerRelative)
            .contentShape(.containerRelative.inset(by: -10))
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in
                withAnimation(.spring(duration: 0.1)) {
                    isHighlighted = true
                }
            }.onEnded { _ in
                withAnimation(.spring(duration: 0.5)) {
                    isHighlighted = false
                }
            })
            .containerShape(.capsule)
    }
}

#if DEBUG
@available(iOS 18, *)
#Preview {
    ExploreCategoryRow(site: .sampleFeaturedTelegram, openAction: {})
        .border(.red)
        .padding(20)
}
#endif
