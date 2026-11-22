import SwiftUI

@main
struct ManagrApp: App {
    @State private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .tint(Theme.pine)
                .preferredColorScheme(.light)
        }
    }
}