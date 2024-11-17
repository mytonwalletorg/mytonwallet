#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(BottomSheetPlugin, "BottomSheet",
           CAP_PLUGIN_METHOD(prepare, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(delegate, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(release, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(openSelf, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(closeSelf, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(toggleSelfFullSize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(openInMain, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(applyScrollPatch, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(clearScrollPatch, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disable, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(enable, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(hide, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(show, CAPPluginReturnPromise);
)
