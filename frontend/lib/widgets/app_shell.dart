import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'mode_toggle.dart';

class _Dest {
  const _Dest(this.path, this.icon, this.label);

  final String path;
  final IconData icon;
  final String label;
}

const _destinations = [
  _Dest('/', Icons.dashboard_outlined, 'Dashboard'),
  _Dest('/wallets', Icons.account_balance_wallet_outlined, 'Wallets'),
  _Dest('/smart-send', Icons.bolt_outlined, 'Smart Send'),
  _Dest('/payments', Icons.receipt_long_outlined, 'Payments'),
  _Dest('/transactions', Icons.swap_horiz, 'Transactions'),
  _Dest('/invoices', Icons.description_outlined, 'Invoices'),
  _Dest('/customers', Icons.people_outline, 'Customers'),
  _Dest('/settlements', Icons.account_balance_outlined, 'Settlements'),
  _Dest('/analytics', Icons.insights_outlined, 'Analytics'),
  _Dest('/coins', Icons.currency_bitcoin, 'Coins'),
  _Dest('/converter', Icons.currency_exchange, 'Converter'),
  _Dest('/token-of-day', Icons.star_outline, 'Token of Day'),
  _Dest('/revenue', Icons.trending_up, 'Revenue'),
  _Dest('/developers', Icons.vpn_key_outlined, 'Developers'),
  _Dest('/settings', Icons.settings_outlined, 'Settings'),
];

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  int _indexFor(String location) {
    var best = 0;
    var bestLen = -1;
    for (var i = 0; i < _destinations.length; i++) {
      final path = _destinations[i].path;
      if (location == path || (path != '/' && location.startsWith(path))) {
        if (path.length > bestLen) {
          best = i;
          bestLen = path.length;
        }
      }
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    final index = _indexFor(location);
    final wide = MediaQuery.sizeOf(context).width >= 960;

    void goTo(int value) => context.go(_destinations[value].path);

    Widget sidebar() {
      return SizedBox(
        width: 232,
        child: Material(
          color: Theme.of(context).colorScheme.surfaceContainerLowest,
          child: ListView(
            children: [
              for (var i = 0; i < _destinations.length; i++)
                Material(
                  color: i == index
                      ? Theme.of(context).colorScheme.primaryContainer
                      : Colors.transparent,
                  child: InkWell(
                    onTap: () => goTo(i),
                    child: ListTile(
                      leading: Icon(_destinations[i].icon),
                      title: Text(_destinations[i].label),
                      selected: i == index,
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      drawer: wide
          ? null
          : Drawer(
              child: ListView(
                children: [
                  const DrawerHeader(child: Text('CryptoChain')),
                  for (var i = 0; i < _destinations.length; i++)
                    ListTile(
                      leading: Icon(_destinations[i].icon),
                      title: Text(_destinations[i].label),
                      selected: i == index,
                      onTap: () {
                        Navigator.pop(context);
                        goTo(i);
                      },
                    ),
                ],
              ),
            ),
      body: Column(
        children: [
          const MerchantChrome(),
          Expanded(
            child: Row(
              children: [
                if (wide) sidebar(),
                Expanded(child: child),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
