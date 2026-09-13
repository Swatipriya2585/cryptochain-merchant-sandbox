import 'app_mode.dart';

/// Compile-time and runtime rules that keep release builds off mainnet
/// unless `--dart-define=ENABLE_LIVE_MODE=true` is set.
class EnvPolicy {
  const EnvPolicy({
    required this.isReleaseBuild,
    required this.enableLiveModeFlag,
  });

  /// True for `flutter run --release` / store builds (`kReleaseMode`).
  final bool isReleaseBuild;

  /// `--dart-define=ENABLE_LIVE_MODE=true`
  final bool enableLiveModeFlag;

  /// The Settings toggle is debug/profile, or release with the explicit flag.
  bool get showModeToggle => !isReleaseBuild || enableLiveModeFlag;

  /// LIVE may be selected in debug/profile, or in release only with the flag.
  bool get canSelectLive => !isReleaseBuild || enableLiveModeFlag;

  AppMode coerce(AppMode requested) {
    if (requested == AppMode.live && !canSelectLive) {
      return AppMode.sandbox;
    }
    return requested;
  }
}
