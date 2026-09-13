import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_mode.dart';
import '../providers/env_controller.dart';

/// Persistent Stripe-style test-mode banner. Shown on every screen in sandbox.
class ModeBanner extends ConsumerWidget {
  const ModeBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(envControllerProvider).value;
    if (session == null) {
      return const SizedBox.shrink();
    }

    if (session.mode == AppMode.sandbox) {
      return const ModeBannerView(mode: AppMode.sandbox);
    }

    return const ModeBannerView(mode: AppMode.live);
  }
}

class ModeBannerView extends StatelessWidget {
  const ModeBannerView({super.key, required this.mode});

  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    if (mode == AppMode.sandbox) {
      return const _BannerBar(
        label: 'SANDBOX MODE',
        detail: 'Sepolia testnet · no real funds',
        color: Color(0xFFFFC107),
        foreground: Color(0xFF3E2723),
      );
    }

    return const _BannerBar(
      label: 'LIVE MODE',
      detail: 'Mainnet · real funds',
      color: Color(0xFFC62828),
      foreground: Colors.white,
    );
  }
}

class _BannerBar extends StatelessWidget {
  const _BannerBar({
    required this.label,
    required this.detail,
    required this.color,
    required this.foreground,
  });

  final String label;
  final String detail;
  final Color color;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(Icons.science_outlined, color: foreground, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '$label  ',
                        style: TextStyle(
                          color: foreground,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.6,
                        ),
                      ),
                      TextSpan(
                        text: detail,
                        style: TextStyle(color: foreground.withValues(alpha: 0.9)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
