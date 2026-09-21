import 'package:flutter/material.dart';

import '../core/api_exception.dart';

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({
    super.key,
    required this.error,
    this.onRetry,
    this.onUseSandbox,
  });

  final Object error;
  final VoidCallback? onRetry;
  final VoidCallback? onUseSandbox;

  @override
  Widget build(BuildContext context) {
    final message = error is ApiException
        ? (error as ApiException).merchantMessage
        : error.toString() == 'Bad state: not-configured'
        ? 'LIVE needs a merchant ID and API key in Settings, or switch to Sandbox Mode.'
        : "Can't complete this right now. Please try again.";

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.info_outline, size: 40, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            if (onUseSandbox != null) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onUseSandbox,
                icon: const Icon(Icons.science_outlined),
                label: const Text('Use Sandbox Mode'),
              ),
              const SizedBox(height: 8),
              Text(
                'Sandbox runs entirely on this device — no backend required.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              TextButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}
