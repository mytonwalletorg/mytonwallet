#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(DialogPlugin, "Dialog",
           CAP_PLUGIN_METHOD(alert, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(prompt, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(confirm, CAPPluginReturnPromise);
)
