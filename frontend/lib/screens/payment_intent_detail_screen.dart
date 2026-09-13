import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../data/models/payment_intent.dart';
import '../providers/payments_providers.dart';
import '../widgets/error_panel.dart';
import '../widgets/status_chip.dart';

class PaymentIntentDetailScreen extends ConsumerWidget {
  const PaymentIntentDetailScreen({super.key, required this.paymentIntentId});

  final String paymentIntentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(paymentDetailProvider(paymentIntentId));

    return Scaffold(
      appBar: AppBar(title: const Text('Payment')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorPanel(
          error: error,
          onRetry: () => ref.invalidate(paymentDetailProvider(paymentIntentId)),
        ),
        data: (intent) => _DetailBody(intent: intent),
      ),
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.intent});

  final PaymentIntent intent;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            StatusChip(status: intent.status),
            const Spacer(),
            _Countdown(expiresAt: intent.expiresAt),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          '${intent.amountRequestedCrypto} ${intent.currencyCrypto}',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        Text(
          'Status updates every 5 seconds · ${intent.network}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 20),
        if (intent.paymentUri.isNotEmpty) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text('Scan to pay'),
                  const SizedBox(height: 12),
                  QrImageView(
                    data: intent.paymentUri,
                    size: 220,
                    backgroundColor: Colors.white,
                  ),
                  const SizedBox(height: 12),
                  SelectableText(
                    intent.paymentUri,
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: intent.paymentUri));
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Payment link copied')),
                        );
                      }
                    },
                    icon: const Icon(Icons.copy),
                    label: const Text('Copy payment URI'),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        _Meta(label: 'Reference', value: intent.reference),
        _Meta(label: 'Receive address', value: intent.expectedAddress),
        if (intent.txHash != null) _Meta(label: 'Transaction', value: intent.txHash!),
        _Meta(label: 'Confirmations', value: '${intent.confirmations}'),
        if (intent.receivedAmountCrypto != null)
          _Meta(label: 'Received', value: '${intent.receivedAmountCrypto} ${intent.currencyCrypto}'),
      ],
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          SelectableText(value),
        ],
      ),
    );
  }
}

class _Countdown extends StatelessWidget {
  const _Countdown({required this.expiresAt});

  final DateTime expiresAt;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DateTime>(
      stream: Stream<DateTime>.periodic(const Duration(seconds: 1), (_) => DateTime.now()),
      initialData: DateTime.now(),
      builder: (context, snapshot) {
        final now = snapshot.data ?? DateTime.now();
        final remaining = expiresAt.difference(now);
        if (remaining.isNegative) {
          return Text(
            'Expired',
            style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w600),
          );
        }
        final hours = remaining.inHours;
        final minutes = remaining.inMinutes.remainder(60).toString().padLeft(2, '0');
        final seconds = remaining.inSeconds.remainder(60).toString().padLeft(2, '0');
        final label = hours > 0 ? '$hours:$minutes:$seconds' : '$minutes:$seconds';
        return Text('Expires in $label', style: Theme.of(context).textTheme.titleSmall);
      },
    );
  }
}
