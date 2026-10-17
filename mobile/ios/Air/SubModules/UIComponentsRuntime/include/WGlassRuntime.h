#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
UIView * _Nullable WMakeLiquidLens(void);
void WConfigureLiquidLens(UIView *lens, UIView *selectedContent, UIView *normalContent);
void WSetLiquidLensLifted(UIView *lens, BOOL lifted, BOOL animated, void (^alongside)(void));
void WSetTitleBlur(UIView *view, CGFloat radius);
CGFloat WTitleBlurRadius(UIView *view);
void WAnimateTitleBlur(UIView *view, CGFloat fromRadius, CAAnimation * _Nullable timing);
BOOL WInstallBarFlex(UIView *view);
NS_ASSUME_NONNULL_END
