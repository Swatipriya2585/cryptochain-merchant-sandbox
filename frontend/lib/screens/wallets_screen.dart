import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../providers/merchant_mode_controller.dart';
import '../sandbox/models.dart';
import '../sandbox/store.dart';

const _networks = ['ethereum', 'base', 'polygon'];

class WalletsScreen extends ConsumerStatefulWidget {
  const WalletsScreen({super.key});

  @override
  ConsumerState<WalletsScreen> createState() => _WalletsScreenState();
}

class _WalletsScreenState extends ConsumerState<WalletsScreen> {
  int _networkIndex = 0;
  bool _allAssets = false;

  @override
  Widget build(BuildContext context) {
    final sandbox = ref.watch(isSandboxProvider);
    final state = ref.watch(sandboxStoreProvider);
    final network = _networks[_networkIndex];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wallets'),
        actions: [
          TextButton(
            onPressed: () => setState(() => _allAssets = !_allAssets),
            child: Text(_allAssets ? 'Filter by network' : 'View all assets'),
          ),
        ],
      ),
      body: !sandbox
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'No live wallets yet. Switch to SANDBOX to explore mock wallets, '
                  'or import a mainnet address from Settings.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    for (var i = 0; i < _networks.length; i++)
                      ChoiceChip(
                        label: Text(_networks[i][0].toUpperCase() + _networks[i].substring(1)),
                        selected: _networkIndex == i,
                        onSelected: (_) => setState(() => _networkIndex = i),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  'Default wallet · ${network[0].toUpperCase()}${network.substring(1)}',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey('default-$network-${state.defaultWalletByNetwork[network]}'),
                  initialValue: state.defaultWalletByNetwork[network],
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'Set default wallet per network',
                  ),
                  items: [
                    for (final wallet in state.wallets.where((w) => w.networks.contains(network)))
                      DropdownMenuItem(value: wallet.id, child: Text(wallet.name)),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      ref.read(sandboxStoreProvider.notifier).setDefaultWallet(network, value);
                    }
                  },
                ),
                const SizedBox(height: 16),
                for (final wallet in state.wallets.where((w) {
                  if (_allAssets) return true;
                  return w.networks.contains(network);
                }))
                  _WalletCard(
                    wallet: wallet,
                    network: _allAssets ? wallet.networks.first : network,
                    showAllAssets: _allAssets,
                    isDefault: state.defaultWalletByNetwork[network] == wallet.id ||
                        (_allAssets && state.defaultWalletByNetwork[wallet.networks.first] == wallet.id),
                  ),
              ],
            ),
    );
  }
}

class _WalletCard extends ConsumerWidget {
  const _WalletCard({
    required this.wallet,
    required this.network,
    required this.showAllAssets,
    required this.isDefault,
  });

  final MerchantWallet wallet;
  final String network;
  final bool showAllAssets;
  final bool isDefault;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assets = showAllAssets
        ? wallet.assets
        : wallet.assets.where((asset) => asset.network == network).toList();
    final visible = assets.isEmpty ? wallet.assets : assets;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    wallet.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (isDefault)
                  const Chip(label: Text('Default'), visualDensity: VisualDensity.compact),
                IconButton(
                  tooltip: 'Rename',
                  onPressed: () => _rename(context, ref),
                  icon: const Icon(Icons.edit_outlined),
                ),
              ],
            ),
            SelectableText(wallet.address, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Text(
              formatUsd(wallet.portfolioUsd),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            for (final asset in visible)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${asset.balance.toStringAsFixed(4)} ${asset.symbol}'),
                subtitle: Text('${asset.name} · ${asset.network}'),
                trailing: Text(formatUsd(asset.usdValue)),
              ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  onPressed: () => _send(context, ref),
                  icon: const Icon(Icons.north_east),
                  label: const Text('Send money'),
                ),
                FilledButton.icon(
                  onPressed: () => _receive(context),
                  icon: const Icon(Icons.south_west),
                  label: const Text('Receive money'),
                ),
                OutlinedButton.icon(
                  onPressed: () => _details(context, ref),
                  icon: const Icon(Icons.info_outline),
                  label: const Text('Details'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _rename(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController(text: wallet.name);
    final next = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rename wallet'),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (next != null) {
      await ref.read(sandboxStoreProvider.notifier).renameWallet(wallet.id, next);
    }
  }

  Future<void> _send(BuildContext context, WidgetRef ref) async {
    final amount = TextEditingController(text: '10');
    final recipient = TextEditingController(
      text: wallet.chainFamily == 'solana' ? 'So1SANDBOXrecipient0001' : '0xSANDBOXrecipient0001',
    );
    final symbol = wallet.assets.first.symbol;
    var selected = symbol;
    await showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Send money'),
          content: StatefulBuilder(
            builder: (context, setLocal) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: selected,
                    items: [
                      for (final asset in wallet.assets)
                        DropdownMenuItem(value: asset.symbol, child: Text(asset.symbol)),
                    ],
                    onChanged: (value) => setLocal(() => selected = value ?? selected),
                  ),
                  TextField(
                    controller: amount,
                    decoration: const InputDecoration(labelText: 'Amount'),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                  TextField(
                    controller: recipient,
                    decoration: const InputDecoration(labelText: 'Recipient'),
                  ),
                ],
              );
            },
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                await ref.read(sandboxStoreProvider.notifier).applySend(
                  walletId: wallet.id,
                  symbol: selected,
                  amount: double.tryParse(amount.text) ?? 0,
                  recipient: recipient.text,
                );
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text('Send'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _receive(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Receive money'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            QrImageView(data: wallet.address, size: 180, backgroundColor: Colors.white),
            const SizedBox(height: 12),
            SelectableText(wallet.address),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: wallet.address));
              if (context.mounted) Navigator.pop(context);
            },
            icon: const Icon(Icons.copy),
            label: const Text('Copy address'),
          ),
        ],
      ),
    );
  }

  Future<void> _details(BuildContext context, WidgetRef ref) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(wallet.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Family: ${wallet.chainFamily}'),
            const SizedBox(height: 8),
            SelectableText(wallet.address),
            const SizedBox(height: 8),
            Text('Networks: ${wallet.networks.join(', ')}'),
            Text('Portfolio: ${formatUsd(wallet.portfolioUsd)}'),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
