enum PaymentStatus {
  pending,
  underpaid,
  overpaid,
  confirmed,
  expired;

  static PaymentStatus fromApi(String value) {
    return PaymentStatus.values.firstWhere(
      (item) => item.name.toUpperCase() == value.toUpperCase(),
      orElse: () => PaymentStatus.pending,
    );
  }

  String get apiValue => name.toUpperCase();

  String get label => switch (this) {
    PaymentStatus.pending => 'Waiting',
    PaymentStatus.underpaid => 'Underpaid',
    PaymentStatus.overpaid => 'Overpaid',
    PaymentStatus.confirmed => 'Confirmed',
    PaymentStatus.expired => 'Expired',
  };
}

class PaymentIntent {
  const PaymentIntent({
    required this.id,
    required this.merchantId,
    required this.amountRequestedCrypto,
    required this.currencyCrypto,
    required this.expectedAddress,
    required this.reference,
    required this.status,
    required this.txHash,
    required this.txBlockNumber,
    required this.confirmations,
    required this.receivedAmountCrypto,
    required this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
    required this.network,
    required this.chainId,
    required this.paymentUri,
  });

  final String id;
  final String merchantId;
  final String amountRequestedCrypto;
  final String currencyCrypto;
  final String expectedAddress;
  final String reference;
  final PaymentStatus status;
  final String? txHash;
  final int? txBlockNumber;
  final int confirmations;
  final String? receivedAmountCrypto;
  final DateTime expiresAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String network;
  final int chainId;
  final String paymentUri;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  Duration remaining(DateTime now) {
    final delta = expiresAt.difference(now);
    return delta.isNegative ? Duration.zero : delta;
  }

  factory PaymentIntent.fromJson(Map<String, dynamic> json) {
    return PaymentIntent(
      id: json['id'] as String,
      merchantId: json['merchantId'] as String,
      amountRequestedCrypto: json['amountRequestedCrypto'].toString(),
      currencyCrypto: json['currencyCrypto'] as String,
      expectedAddress: json['expectedAddress'] as String,
      reference: json['reference'] as String,
      status: PaymentStatus.fromApi(json['status'] as String),
      txHash: json['txHash'] as String?,
      txBlockNumber: json['txBlockNumber'] as int?,
      confirmations: (json['confirmations'] as num?)?.toInt() ?? 0,
      receivedAmountCrypto: json['receivedAmountCrypto']?.toString(),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      network: json['network'] as String? ?? 'sepolia',
      chainId: (json['chainId'] as num?)?.toInt() ?? 11155111,
      paymentUri: json['paymentUri'] as String? ?? '',
    );
  }
}

class PaginatedPaymentIntents {
  const PaginatedPaymentIntents({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<PaymentIntent> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory PaginatedPaymentIntents.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? [])
        .map((item) => PaymentIntent.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedPaymentIntents(
      items: items,
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? items.length,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}
