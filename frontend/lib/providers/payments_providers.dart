import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/cryptochain_api.dart';
import '../data/models/merchant_summary.dart';
import '../data/models/payment_intent.dart';
import '../sandbox/merchant_mode.dart';
import '../sandbox/sandbox_repository.dart';
import '../sandbox/store.dart';
import 'env_controller.dart';
import 'merchant_mode_controller.dart';

final cryptochainRepositoryProvider = Provider<CryptochainRepository>((ref) {
  final mode = ref.watch(merchantModeProvider);
  if (mode == MerchantMode.sandbox) {
    return SandboxCryptochainRepository(ref.read(sandboxStoreProvider.notifier));
  }
  final session = ref.watch(envControllerProvider).value;
  if (session == null) {
    throw StateError('Environment is still loading');
  }
  return RemoteCryptochainRepository(CryptochainApi.fromSession(session.profile));
});

final summaryProvider = FutureProvider<MerchantSummary>((ref) async {
  final mode = ref.watch(merchantModeProvider);
  if (mode == MerchantMode.sandbox) {
    ref.watch(sandboxStoreProvider);
    return ref.watch(cryptochainRepositoryProvider).getSummary();
  }
  final env = await ref.watch(envControllerProvider.future);
  if (!env.profile.isConfigured) {
    throw StateError('not-configured');
  }
  return ref.watch(cryptochainRepositoryProvider).getSummary();
});

class PaymentListQuery {
  const PaymentListQuery({this.status});

  final PaymentStatus? status;

  @override
  bool operator ==(Object other) =>
      other is PaymentListQuery && other.status == status;

  @override
  int get hashCode => status.hashCode;
}

final paymentListQueryProvider = NotifierProvider<PaymentListQueryNotifier, PaymentListQuery>(
  PaymentListQueryNotifier.new,
);

class PaymentListQueryNotifier extends Notifier<PaymentListQuery> {
  @override
  PaymentListQuery build() => const PaymentListQuery();

  void setStatus(PaymentStatus? status) {
    state = PaymentListQuery(status: status);
  }
}

final paymentListProvider = FutureProvider<PaginatedPaymentIntents>((ref) async {
  if (ref.watch(merchantModeProvider) != MerchantMode.sandbox) {
    await ref.watch(envControllerProvider.future);
  } else {
    ref.watch(sandboxStoreProvider);
  }
  final query = ref.watch(paymentListQueryProvider);
  return ref.watch(cryptochainRepositoryProvider).listPaymentIntents(status: query.status);
});

final paymentDetailProvider = StreamProvider.autoDispose.family<PaymentIntent, String>((
  ref,
  id,
) async* {
  if (ref.watch(merchantModeProvider) != MerchantMode.sandbox) {
    await ref.watch(envControllerProvider.future);
  } else {
    ref.watch(sandboxStoreProvider);
  }
  final repo = ref.watch(cryptochainRepositoryProvider);
  yield await repo.getPaymentIntent(id);
  await for (final _ in Stream<void>.periodic(const Duration(seconds: 5))) {
    yield await repo.getPaymentIntent(id);
  }
});
