import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var app
    @State private var started = false

    var body: some View {
        Group {
            if app.isConnected {
                MainTabView()
            } else if app.isConnecting && app.shell == nil {
                SplashView()
            } else {
                ConnectView()
            }
        }
        .task {
            guard !started else { return }
            started = true
            await app.autoConnect()
        }
    }
}

struct MainTabView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        TabView {
            NavigationStack {
                DashboardView()
            }
            .tabItem {
                Label(app.t("Übersicht", "Overview"), systemImage: "rectangle.grid.2x2")
            }

            NavigationStack {
                InvoicesView()
            }
            .tabItem {
                Label(app.t("Rechnungen", "Invoices"), systemImage: "doc.text")
            }

            NavigationStack {
                CustomersView()
            }
            .tabItem {
                Label(app.t("Kunden", "Customers"), systemImage: "building.2")
            }

            NavigationStack {
                TimeView()
            }
            .tabItem {
                Label(app.t("Zeit", "Time"), systemImage: "clock")
            }

            NavigationStack {
                MoreView()
            }
            .tabItem {
                Label(app.t("Mehr", "More"), systemImage: "ellipsis.circle")
            }
        }
        .tint(Theme.pine)
    }
}

struct SplashView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        VStack(spacing: 18) {
            Text("managr")
                .font(.display(46))
                .foregroundStyle(Theme.pine)
            ProgressView()
                .tint(Theme.pine)
            Text(app.t("Verbinde mit \(app.serverAddress) …", "Connecting to \(app.serverAddress) …"))
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .deskBackground()
    }
}