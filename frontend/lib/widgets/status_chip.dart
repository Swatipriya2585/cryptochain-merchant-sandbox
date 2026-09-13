import 'package:flutter/material.dart';

import '../data/models/payment_intent.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status});

  final PaymentStatus status;

  @override
  Widget build(BuildContext context) {
    final (color, onColor) = switch (status) {
      PaymentStatus.pending => (const Color(0xFFFFF8E1), const Color(0xFFF9A825)),
      PaymentStatus.confirmed => (const Color(0xFFE8F5E9), const Color(0xFF2E7D32)),
      PaymentStatus.expired => (const Color(0xFFEEEEEE), const Color(0xFF616161)),
      PaymentStatus.underpaid => (const Color(0xFFFFF3E0), const Color(0xFFEF6C00)),
      PaymentStatus.overpaid => (const Color(0xFFE3F2FD), const Color(0xFF1565C0)),
    };

    return Chip(
      label: Text(status.label),
      backgroundColor: color,
      labelStyle: TextStyle(color: onColor, fontWeight: FontWeight.w600),
      visualDensity: VisualDensity.compact,
      side: BorderSide.none,
    );
  }
}
