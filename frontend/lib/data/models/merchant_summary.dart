class MerchantSummary {
  const MerchantSummary({
    required this.merchantId,
    required this.network,
    required this.totalConfirmedVolumeCrypto,
    required this.currencyCrypto,
    required this.pendingCount,
    required this.confirmedCount,
    required this.expiredCount,
    required this.totalPaymentIntents,
    required this.successRate,
    required this.successRatePercent,
    required this.avgConfirmationTimeSeconds,
    required this.payoutsPending,
    required this.payoutsPaid,
  });

  final String merchantId;
  final String network;
  final String totalConfirmedVolumeCrypto;
  final String currencyCrypto;
  final int pendingCount;
  final int confirmedCount;
  final int expiredCount;
  final int totalPaymentIntents;
  final double successRate;
  final double successRatePercent;
  final int? avgConfirmationTimeSeconds;
  final int payoutsPending;
  final int payoutsPaid;

  factory MerchantSummary.fromJson(Map<String, dynamic> json) {
    return MerchantSummary(
      merchantId: json['merchantId'] as String,
      network: json['network'] as String? ?? 'sepolia',
      totalConfirmedVolumeCrypto: json['totalConfirmedVolumeCrypto'].toString(),
      currencyCrypto: json['currencyCrypto'] as String? ?? 'ETH',
      pendingCount: (json['pendingCount'] as num?)?.toInt() ?? 0,
      confirmedCount: (json['confirmedCount'] as num?)?.toInt() ?? 0,
      expiredCount: (json['expiredCount'] as num?)?.toInt() ?? 0,
      totalPaymentIntents: (json['totalPaymentIntents'] as num?)?.toInt() ?? 0,
      successRate: (json['successRate'] as num?)?.toDouble() ?? 0,
      successRatePercent: (json['successRatePercent'] as num?)?.toDouble() ?? 0,
      avgConfirmationTimeSeconds: (json['avgConfirmationTimeSeconds'] as num?)?.toInt(),
      payoutsPending: (json['payoutsPending'] as num?)?.toInt() ?? 0,
      payoutsPaid: (json['payoutsPaid'] as num?)?.toInt() ?? 0,
    );
  }
}
