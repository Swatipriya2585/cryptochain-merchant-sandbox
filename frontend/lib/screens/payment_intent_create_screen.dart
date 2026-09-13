import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
import '../providers/payments_providers.dart';

class PaymentIntentCreateScreen extends ConsumerStatefulWidget {
  const PaymentIntentCreateScreen({super.key});

  @override
  ConsumerState<PaymentIntentCreateScreen> createState() =>
      _PaymentIntentCreateScreenState();
}

class _PaymentIntentCreateScreenState extends ConsumerState<PaymentIntentCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController(text: '0.01');
  String _currency = 'ETH';
  int _expiresInMinutes = 20;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final intent = await ref.read(cryptochainRepositoryProvider).createPaymentIntent(
        amountRequestedCrypto: _amount.text.trim(),
        currencyCrypto: _currency,
        expiresInMinutes: _expiresInMinutes,
      );
      if (!mounted) return;
      context.go('/payments/${intent.id}');
    } catch (error) {
      setState(() {
        _error = error is ApiException
            ? error.merchantMessage
            : "Couldn't create this payment. Please try again.";
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New payment')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Ask a customer to pay on Sepolia. You will get a QR code next.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount',
                hintText: '0.01',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                final parsed = double.tryParse(value?.trim() ?? '');
                if (parsed == null || parsed <= 0) {
                  return 'Enter an amount greater than zero';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _currency,
              decoration: const InputDecoration(
                labelText: 'Crypto currency',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'ETH', child: Text('ETH')),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _currency = value);
              },
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<int>(
              initialValue: _expiresInMinutes,
              decoration: const InputDecoration(
                labelText: 'Expires in',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 10, child: Text('10 minutes')),
                DropdownMenuItem(value: 20, child: Text('20 minutes')),
                DropdownMenuItem(value: 60, child: Text('1 hour')),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _expiresInMinutes = value);
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Create payment'),
            ),
          ],
        ),
      ),
    );
  }
}
