import '../data/cryptochain_api.dart';
import '../data/models/merchant_summary.dart';
import '../data/models/payment_intent.dart';
import 'models.dart';
import 'store.dart';

/// Maps sandbox store rows onto the live [CryptochainRepository] surface so
/// existing payment screens keep working without calling Dio / Prisma / chain.
class SandboxCryptochainRepository implements CryptochainRepository {
  SandboxCryptochainRepository(this._store);

  final SandboxStore _store;

  SandboxState get _state => _store.snapshot;

  @override
  Future<MerchantSummary> getSummary() async {
    final metrics = _state.metrics;
    return MerchantSummary(
      merchantId: 'merchant_sandbox',
      network: 'sandbox',
      totalConfirmedVolumeCrypto: metrics.confirmedVolumeCrypto,
      currencyCrypto: metrics.currencyCrypto,
      pendingCount: metrics.pendingCount,
      confirmedCount: metrics.confirmedCount,
      expiredCount: _state.payments.where((p) => p.status == 'EXPIRED').length,
      totalPaymentIntents: metrics.totalPaymentIntents,
      successRate: metrics.successRatePercent / 100,
      successRatePercent: metrics.successRatePercent,
      avgConfirmationTimeSeconds: metrics.avgConfirmationSeconds.round(),
      payoutsPending: _state.settlements.where((s) => s.status == 'pending').length,
      payoutsPaid: _state.settlements.where((s) => s.status == 'completed').length,
    );
  }

  @override
  Future<PaginatedPaymentIntents> listPaymentIntents({
    PaymentStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    var items = _state.payments.map(_toIntent).toList();
    if (status != null) {
      items = items.where((item) => item.status == status).toList();
    }
    final start = (page - 1) * limit;
    final slice = start >= items.length
        ? <PaymentIntent>[]
        : items.sublist(start, start + limit > items.length ? items.length : start + limit);
    return PaginatedPaymentIntents(
      items: slice,
      page: page,
      limit: limit,
      total: items.length,
      totalPages: items.isEmpty ? 1 : (items.length / limit).ceil(),
    );
  }

  @override
  Future<PaymentIntent> getPaymentIntent(String id) async {
    final match = _state.payments.where((item) => item.id == id).firstOrNull;
    if (match == null) {
      throw StateError('Unknown sandbox payment $id');
    }
    return _toIntent(match);
  }

  @override
  Future<PaymentIntent> createPaymentIntent({
    required String amountRequestedCrypto,
    required String currencyCrypto,
    required int expiresInMinutes,
  }) async {
    final created = await _store.addPayment(
      amountCrypto: amountRequestedCrypto,
      currencyCrypto: currencyCrypto,
    );
    return _toIntent(created);
  }

  PaymentIntent _toIntent(SandboxPayment payment) {
    final created = payment.createdAt;
    return PaymentIntent(
      id: payment.id,
      merchantId: 'merchant_sandbox',
      amountRequestedCrypto: payment.amountCrypto,
      currencyCrypto: payment.currency,
      expectedAddress: payment.address,
      reference: payment.reference,
      status: PaymentStatus.fromApi(payment.status),
      txHash: payment.txHash,
      txBlockNumber: payment.txHash == null ? null : 18880000,
      confirmations: payment.status == 'CONFIRMED' ? 12 : 0,
      receivedAmountCrypto: payment.status == 'CONFIRMED' ? payment.amountCrypto : null,
      expiresAt: created.add(const Duration(hours: 1)),
      createdAt: created,
      updatedAt: created,
      network: 'sandbox-${payment.network}',
      chainId: 0,
      paymentUri: 'ethereum:${payment.address}?amount=${payment.amountCrypto}',
    );
  }
}
