
import SwiftUI
import UIComponents
import WalletCore
import WalletContext

struct AddViewWalletView: View {
    
    var onChange: (String) -> ()
    var onSumit: () -> ()
    
    @State var value: String = ""
    @State var isFocused: Bool = false
    
    var body: some View {
        ZStack(alignment: .top) {
            Color.clear.frame(height: 200)
            VStack(spacing: 24) {
                Text("Enter **any address** on TON or TRON network to open it in **View Mode**.")
                    .font(.system(size: 17))
                    .multilineTextAlignment(.center)
                addressView
            }
        }
        .onAppear {
            if value.isEmpty {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) {
                    isFocused = true
                }
            }
        }
        .onChange(of: value) { onChange($0) }
    }
    
    var addressView: some View {
        InsetSection(backgroundColor: WTheme.sheetBackground, horizontalPadding: -16) {
            InsetCell(verticalPadding: 14) {
                HStack {
                    AddressTextField(
                        value: $value,
                        isFocused: $isFocused,
                        onNext: { onSumit() }
                    )
                    .offset(y: 1)
                    .background(alignment: .leading) {
                        if value.isEmpty {
                            Text(WStrings.Send_AddressOrDomain.localized)
                                .foregroundStyle(Color(UIColor.placeholderText))
                        }
                    }
                    
                    if value.isEmpty {
                        HStack(spacing: 12) {
                            Button(action: onPaste) {
                                Text("Paste")
                            }
//                                    Button(action: { model.onScanPressed() }) {
//                                        Image("ScanIcon", bundle: AirBundle)
//                                            .renderingMode(.template)
//                                    }
                        }
                        .offset(x: 4)
                        .padding(.vertical, -1)
                    } else {
                        Button(action: { value = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .tint(Color(WTheme.secondaryFill))
                                .scaleEffect(0.9)
                        }
                    }
                }
                .buttonStyle(.borderless)
            }
            .contentShape(.rect)
            .onTapGesture {
                isFocused = true
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    func onPaste() {
        if let string = UIPasteboard.general.string?.nilIfEmpty {
            value = string
        }
    }
}
