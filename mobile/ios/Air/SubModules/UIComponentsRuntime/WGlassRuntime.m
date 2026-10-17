#import "WGlassRuntime.h"
#import <objc/message.h>

// Telegram LiquidLens adapter. Names are XOR encoded; calls are checked at runtime.
static NSString *Decode(const unsigned char *bytes, NSUInteger count) {
    NSMutableData *data = [NSMutableData dataWithLength:count];
    unsigned char *out = data.mutableBytes;
    for (NSUInteger i = 0; i < count; i++) out[i] = bytes[i] ^ 0xA7;
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}
static NSString *lensClass(void) { const unsigned char b[] = {248, 242, 238, 235, 206, 214, 210, 206, 195, 235, 194, 201, 212, 241, 206, 194, 208}; return Decode(b, sizeof(b)); }
static NSString *initialize(void) { const unsigned char b[] = {206, 201, 206, 211, 240, 206, 211, 207, 245, 194, 212, 211, 206, 201, 192, 229, 198, 196, 204, 192, 213, 200, 210, 201, 195, 157}; return Decode(b, sizeof(b)); }
static NSString *content(void) { const unsigned char b[] = {212, 194, 211, 235, 206, 193, 211, 194, 195, 228, 200, 201, 211, 194, 201, 211, 241, 206, 194, 208, 157}; return Decode(b, sizeof(b)); }
static NSString *punchout(void) { const unsigned char b[] = {212, 194, 211, 232, 209, 194, 213, 213, 206, 195, 194, 247, 210, 201, 196, 207, 200, 210, 211, 241, 206, 194, 208, 157}; return Decode(b, sizeof(b)); }
static NSString *contentMode(void) { const unsigned char b[] = {212, 194, 211, 235, 206, 193, 211, 194, 195, 228, 200, 201, 211, 194, 201, 211, 234, 200, 195, 194, 157}; return Decode(b, sizeof(b)); }
static NSString *style(void) { const unsigned char b[] = {212, 194, 211, 244, 211, 222, 203, 194, 157}; return Decode(b, sizeof(b)); }
static NSString *warp(void) { const unsigned char b[] = {212, 194, 211, 240, 198, 213, 215, 212, 228, 200, 201, 211, 194, 201, 211, 229, 194, 203, 200, 208, 157}; return Decode(b, sizeof(b)); }
static NSString *lift(void) { const unsigned char b[] = {212, 194, 211, 235, 206, 193, 211, 194, 195, 157, 198, 201, 206, 202, 198, 211, 194, 195, 157, 198, 203, 200, 201, 192, 212, 206, 195, 194, 230, 201, 206, 202, 198, 211, 206, 200, 201, 212, 157, 196, 200, 202, 215, 203, 194, 211, 206, 200, 201, 157}; return Decode(b, sizeof(b)); }

static NSString *selectionClass(void) { const unsigned char b[] = {248, 242, 238, 243, 198, 197, 244, 194, 203, 194, 196, 211, 206, 200, 201, 241, 206, 194, 208}; return Decode(b, sizeof(b)); }

UIView *WMakeLiquidLens(void) {
    Class cls = NSClassFromString(lensClass());
    SEL initializeSelector = NSSelectorFromString(initialize());
    if (!cls || ![cls isSubclassOfClass:UIView.class] || ![cls instancesRespondToSelector:initializeSelector]) return nil;
    for (NSString *name in @[content(), punchout(), contentMode(), style(), warp(), lift()]) {
        if (![cls instancesRespondToSelector:NSSelectorFromString(name)]) return nil;
    }
    id allocated = [cls alloc];
    Class backgroundClass = NSClassFromString(selectionClass());
    UIView *background = [backgroundClass isSubclassOfClass:UIView.class] ? [[backgroundClass alloc] initWithFrame:CGRectZero] : [UIView new];
    if (!backgroundClass) background.backgroundColor = [UIColor colorWithWhite:0 alpha:0.075];
    return ((id (*)(id, SEL, id))objc_msgSend)(allocated, initializeSelector, background);
}
static void SetObject(id object, NSString *name, id value) {
    SEL selector = NSSelectorFromString(name);
    if ([object respondsToSelector:selector]) ((void (*)(id, SEL, id))objc_msgSend)(object, selector, value);
}
void WConfigureLiquidLens(UIView *lens, UIView *selectedContent, UIView *normalContent) {
    SetObject(lens, content(), selectedContent);
    SetObject(lens, punchout(), normalContent);
    ((void (*)(id, SEL, NSInteger))objc_msgSend)(lens, NSSelectorFromString(contentMode()), 1);
    ((void (*)(id, SEL, NSInteger))objc_msgSend)(lens, NSSelectorFromString(style()), 1);
    ((void (*)(id, SEL, BOOL))objc_msgSend)(lens, NSSelectorFromString(warp()), YES);
}
void WSetLiquidLensLifted(UIView *lens, BOOL lifted, BOOL animated, void (^alongside)(void)) {
    SEL selector = NSSelectorFromString(lift());
    if ([lens respondsToSelector:selector]) {
        ((void (*)(id, SEL, BOOL, BOOL, void (^)(void), void (^ _Nullable)(void)))objc_msgSend)(lens, selector, lifted, animated, alongside, nil);
    }
}

static NSString *flexClass(void) { const unsigned char b[] = {248, 242, 238, 225, 203, 194, 223, 238, 201, 211, 194, 213, 198, 196, 211, 206, 200, 201}; return Decode(b, sizeof(b)); }

static NSString *activation(void) { const unsigned char b[] = {212, 194, 211, 247, 213, 194, 193, 194, 213, 213, 194, 195, 230, 196, 211, 206, 209, 198, 211, 206, 200, 201, 234, 200, 195, 194, 157}; return Decode(b, sizeof(b)); }

static NSString *sources(void) { const unsigned char b[] = {212, 194, 211, 247, 213, 194, 193, 194, 213, 213, 194, 195, 225, 203, 194, 223, 244, 200, 210, 213, 196, 194, 212, 157}; return Decode(b, sizeof(b)); }

static NSString *variant(void) { const unsigned char b[] = {212, 194, 211, 247, 213, 194, 193, 194, 213, 213, 194, 195, 241, 198, 213, 206, 198, 201, 211, 157}; return Decode(b, sizeof(b)); }

static NSString *presentation(void) { const unsigned char b[] = {212, 194, 211, 244, 207, 200, 210, 203, 195, 242, 212, 194, 247, 213, 194, 212, 194, 201, 211, 198, 211, 206, 200, 201, 235, 198, 222, 194, 213, 212, 157}; return Decode(b, sizeof(b)); }

static NSString *matchingRadii(void) { const unsigned char b[] = {212, 194, 211, 238, 212, 234, 198, 211, 196, 207, 206, 201, 192, 245, 198, 195, 206, 206, 157}; return Decode(b, sizeof(b)); }

BOOL WInstallBarFlex(UIView *view) {
    Class cls = NSClassFromString(flexClass());
    if (!cls || ![cls conformsToProtocol:@protocol(UIInteraction)]) return NO;
    for (NSString *name in @[activation(), sources(), variant(), presentation(), matchingRadii()]) {
        if (![cls instancesRespondToSelector:NSSelectorFromString(name)]) return NO;
    }
    id<UIInteraction> interaction = [[cls alloc] init];
    // Values measured on the system's vertical tab platter in iOS 27.1.
    ((void (*)(id, SEL, NSUInteger))objc_msgSend)(interaction, NSSelectorFromString(activation()), 0);
    ((void (*)(id, SEL, NSUInteger))objc_msgSend)(interaction, NSSelectorFromString(sources()), 3);
    ((void (*)(id, SEL, NSInteger))objc_msgSend)(interaction, NSSelectorFromString(variant()), 0);
    ((void (*)(id, SEL, BOOL))objc_msgSend)(interaction, NSSelectorFromString(presentation()), YES);
    ((void (*)(id, SEL, BOOL))objc_msgSend)(interaction, NSSelectorFromString(matchingRadii()), YES);
    [view addInteraction:interaction];
    return YES;
}

static NSString *filterClass(void) { const unsigned char b[] = {228, 230, 225, 206, 203, 211, 194, 213}; return Decode(b, sizeof(b)); }

static NSString *makeFilter(void) { const unsigned char b[] = {193, 206, 203, 211, 194, 213, 240, 206, 211, 207, 233, 198, 202, 194, 157}; return Decode(b, sizeof(b)); }

static NSString *blurName(void) { const unsigned char b[] = {192, 198, 210, 212, 212, 206, 198, 201, 229, 203, 210, 213}; return Decode(b, sizeof(b)); }

static NSString *blurKeyPath(void) { const unsigned char b[] = {193, 206, 203, 211, 194, 213, 212, 137, 192, 198, 210, 212, 212, 206, 198, 201, 229, 203, 210, 213, 137, 206, 201, 215, 210, 211, 245, 198, 195, 206, 210, 212}; return Decode(b, sizeof(b)); }

void WSetTitleBlur(UIView *view, CGFloat radius) {
    Class cls = NSClassFromString(filterClass());
    SEL selector = NSSelectorFromString(makeFilter());
    if (![cls respondsToSelector:selector]) return;
    if (!view.layer.filters.count) {
        id filter = ((id (*)(id, SEL, id))objc_msgSend)(cls, selector, blurName());
        if (!filter) return;
        view.layer.filters = @[filter];
    }
    [view.layer setValue:@(radius) forKeyPath:blurKeyPath()];
}

CGFloat WTitleBlurRadius(UIView *view) {
    return [[(view.layer.presentationLayer ?: view.layer) valueForKeyPath:blurKeyPath()] doubleValue];
}

void WAnimateTitleBlur(UIView *view, CGFloat fromRadius, CAAnimation *timing) {
    [view.layer removeAnimationForKey:@"wTitleBlur"];
    if (![timing isKindOfClass:CABasicAnimation.class] || !view.layer.filters.count) return;
    CABasicAnimation *animation = (id)[timing copy];
    animation.keyPath = blurKeyPath();
    animation.fromValue = @(fromRadius);
    animation.toValue = [view.layer valueForKeyPath:blurKeyPath()];
    animation.additive = NO;
    animation.removedOnCompletion = YES;
    animation.fillMode = kCAFillModeRemoved;
    [view.layer addAnimation:animation forKey:@"wTitleBlur"];
}
