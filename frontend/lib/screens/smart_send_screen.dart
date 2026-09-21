import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/merchant_mode_controller.dart';
import '../sandbox/models.dart';
import '../sandbox/store.dart';

final smartSendFinalityDelayProvider = Provider<Duration>(
  (ref) => const Duration(seconds: 4),
);

class SmartSendScreen extends ConsumerStatefulWidget {
  const SmartSendScreen({super.key});

  @override
  ConsumerState<SmartSendScreen> createState() => _SmartSendScreenState();
}

class _SmartSendScreenState extends ConsumerState<SmartSendScreen> {
  int _step = 0;
  String? _walletId;
  String _from = 'USDC';
  String _to = 'ETH';
  final _amount = TextEditingController(text: '100');
  final _recipient = TextEditingController(text: '0xSANDBOXmerchant00ab');
  SmartSendQuote? _quote;
  SmartSendActivity? _completed;
  bool _busy = false;

  @override
  void dispose() {
    _amount.dispose();
    _recipient.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sandbox = ref.watch(isSandboxProvider);
    final state = ref.watch(sandboxStoreProvider);
    _walletId ??= state.wallets.where((w) => w.chainFamily == 'evm').firstOrNull?.id ??
        state.wallets.firstOrNull?.id;

    return Scaffold(
      appBar: AppBar(title: const Text('Smart Send')),
      body: !sandbox
          ? const Center(
              child: Text('Smart Send is simulated in SANDBOX. Live routing is not called from here.'),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Stepper(
                  currentStep: _step.clamp(0, 2),
                  controlsBuilder: (context, details) => const SizedBox.shrink(),
                  steps: [
                    Step(
                      title: const Text('Quote'),
                      isActive: _step >= 0,
                      content: _quoteForm(state),
                    ),
                    Step(
                      title: const Text('Review'),
                      isActive: _step >= 1,
                      content: _review(),
                    ),
                    Step(
                      title: const Text('Finality'),
                      isActive: _step >= 2,
                      content: _finality(),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text('Smart Send activity', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                if (state.smartSendActivity.isEmpty)
                  const Text('No Smart Send transfers yet.')
                else
                  for (final item in state.smartSendActivity)
                    Card(
                      child: ListTile(
                        title: Text('${item.amount} ${item.fromSymbol} → ${item.toSymbol}'),
                        subtitle: Text('${item.walletName}\n${item.txHash}'),
                        isThreeLine: true,
                        trailing: Text(item.status),
                      ),
                    ),
              ],
            ),
    );
  }

  Widget _quoteForm(SandboxState state) {
    final wallet = state.walletById(_walletId ?? '');
    return Column(
      children: [
        DropdownButtonFormField<String>(
          key: ValueKey(_walletId),
          initialValue: _walletId,
          decoration: const InputDecoration(labelText: 'Sandbox wallet', border: OutlineInputBorder()),
          items: [
            for (final item in state.wallets)
              DropdownMenuItem(value: item.id, child: Text(item.name)),
          ],
          onChanged: (value) => setState(() => _walletId = value),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _from,
                decoration: const InputDecoration(labelText: 'From', border: OutlineInputBorder()),
                items: [
                  for (final symbol in {
                    ...?wallet?.assets.map((asset) => asset.symbol),
                    ...state.coins.map((coin) => coin.symbol),
                  })
                    DropdownMenuItem(value: symbol, child: Text(symbol)),
                ],
                onChanged: (value) => setState(() => _from = value ?? _from),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _to,
                decoration: const InputDecoration(labelText: 'To', border: OutlineInputBorder()),
                items: [
                  for (final coin in state.coins)
                    DropdownMenuItem(value: coin.symbol, child: Text(coin.symbol)),
                ],
                onChanged: (value) => setState(() => _to = value ?? _to),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _amount,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _recipient,
          decoration: const InputDecoration(labelText: 'Recipient', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _fetchQuote,
          child: const Text('Start Smart Send'),
        ),
      ],
    );
  }

  Widget _review() {
    final quote = _quote;
    if (quote == null) {
      return const Text('Request a quote to continue.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Rate: 1 ${quote.fromSymbol} = ${quote.exchangeRate} ${quote.toSymbol}'),
        Text('You send: ${quote.amount} ${quote.fromSymbol}'),
        Text('They receive: ${quote.receiveAmount} ${quote.toSymbol}'),
        Text('Network fee: ${formatUsd(quote.gasFeeUsd)} (simulated)'),
        Text('Route: ${quote.route}'),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _confirm,
          child: const Text('Review & confirm'),
        ),
      ],
    );
  }

  Widget _finality() {
    if (_busy) {
      return const Column(
        children: [
          LinearProgressIndicator(),
          SizedBox(height: 12),
          Text('Waiting for simulated finality…'),
        ],
      );
    }
    final done = _completed;
    if (done == null) {
      return const Text('Confirm the quote to simulate settlement.');
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Transfer completed (simulated).'),
        const SizedBox(height: 8),
        SelectableText('Tx hash: ${done.txHash}'),
        Text('Route: ${done.route}'),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () => setState(() {
            _step = 0;
            _quote = null;
            _completed = null;
          }),
          child: const Text('Send another'),
        ),
      ],
    );
  }

  Future<void> _fetchQuote() async {
    final amount = double.tryParse(_amount.text) ?? 0;
    if (_walletId == null || amount <= 0 || _recipient.text.trim().isEmpty) {
      return;
    }
    setState(() => _busy = true);
    final quote = await ref.read(sandboxStoreProvider.notifier).quote(
      walletId: _walletId!,
      fromSymbol: _from,
      toSymbol: _to,
      amount: amount,
      recipient: _recipient.text.trim(),
    );
    setState(() {
      _quote = quote;
      _step = 1;
      _busy = false;
    });
  }

  Future<void> _confirm() async {
    final quote = _quote;
    if (quote == null) return;
    setState(() {
      _busy = true;
      _step = 2;
    });
    await Future<void>.delayed(ref.read(smartSendFinalityDelayProvider));
    final activity = await ref.read(sandboxStoreProvider.notifier).completeSmartSend(quote);
    if (!mounted) return;
    setState(() {
      _completed = activity;
      _busy = false;
    });
  }
}
