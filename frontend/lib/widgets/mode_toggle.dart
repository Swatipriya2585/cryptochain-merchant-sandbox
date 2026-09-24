import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_mode.dart';
import '../providers/auth_controller.dart';
import '../providers/env_controller.dart';
import '../providers/merchant_mode_controller.dart';
import '../sandbox/merchant_mode.dart';
import 'mode_banner.dart';

class ModeToggle extends ConsumerWidget {
  const ModeToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(merchantModeProvider);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Pill(
            label: 'LIVE',
            selected: mode == MerchantMode.live,
            selectedColor: const Color(0xFF2E7D32),
            onTap: () {
              if (mode == MerchantMode.live) return;
              _confirmLive(context, ref);
            },
          ),
          _Pill(
            label: 'SANDBOX',
            selected: mode == MerchantMode.sandbox,
            selectedColor: const Color(0xFFEF6C00),
            onTap: () => ref.read(merchantModeProvider.notifier).setMode(MerchantMode.sandbox),
          ),
        ],
      ),
    );
  }
}

Future<void> _confirmLive(BuildContext context, WidgetRef ref) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Switch to LIVE?'),
      content: const Text(
        'LIVE talks to the CryptoChain API (default http://127.0.0.1:4000). '
        'Without that backend the dashboard cannot load. Stay in Sandbox to keep '
        'using simulated data — no server required.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Stay in Sandbox'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Switch to LIVE'),
        ),
      ],
    ),
  );
  if (confirmed == true && context.mounted) {
    await ref.read(merchantModeProvider.notifier).setMode(MerchantMode.live);
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.selectedColor,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color selectedColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(3),
      child: Material(
        color: selected ? selectedColor : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : Theme.of(context).colorScheme.onSurface,
                fontWeight: FontWeight.w800,
                fontSize: 12,
                letterSpacing: 0.6,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Persistent chrome: env banner in live, orange Stripe-style bar in sandbox,
/// plus the LIVE / SANDBOX pills on every page.
class MerchantChrome extends ConsumerWidget {
  const MerchantChrome({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sandbox = ref.watch(isSandboxProvider);
    final env = ref.watch(envControllerProvider).value;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (sandbox)
          const _SandboxBanner()
        else if (env?.mode == AppMode.live)
          const ModeBannerView(mode: AppMode.live)
        else if (env?.mode == AppMode.sandbox)
          const ModeBannerView(mode: AppMode.sandbox),
        Material(
          color: sandbox ? const Color(0xFFFFF3E0) : Theme.of(context).colorScheme.surface,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  if (MediaQuery.sizeOf(context).width < 960)
                    IconButton(
                      tooltip: 'Menu',
                      onPressed: () => Scaffold.of(context).openDrawer(),
                      icon: const Icon(Icons.menu),
                    ),
                  Text(
                    'CryptoChain',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  const ModeToggle(),
                  TextButton(
                    onPressed: () async {
                      await authController.logout();
                    },
                    child: const Text('Sign out'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SandboxBanner extends StatelessWidget {
  const _SandboxBanner();

  @override
  Widget build(BuildContext context) {
    return const Material(
      color: Color(0xFFEF6C00),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(Icons.science_outlined, color: Colors.white, size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  "You're in Sandbox Mode — all data shown is simulated.",
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
