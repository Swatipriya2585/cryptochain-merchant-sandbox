enum AppMode {
  sandbox,
  live;

  String get label => switch (this) {
    AppMode.sandbox => 'SANDBOX',
    AppMode.live => 'LIVE',
  };

  String get apiKeyPrefix => switch (this) {
    AppMode.sandbox => 'sandbox_',
    AppMode.live => 'live_',
  };
}
