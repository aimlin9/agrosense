import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { useAdvisory, useWeather } from '@/api/hooks';
import type { DailyForecast } from '@/api/types';
import { Enter } from '@/components/motion';
import { ScreenTitle } from '@/components/ui/Header';
import { Banner, Card, ErrorState, SectionHeader, Skeleton } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useLocation } from '@/hooks/useLocation';
import { relativeDay, weatherCondition } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const farmer = useAuthStore((s) => s.farmer);
  const location = useLocation({ ask: true });
  const weather = useWeather(location.coords);
  const advisory = useAdvisory(location.coords, farmer?.primary_crop);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([location.refresh(true), weather.refetch(), advisory.refetch()]);
    setRefreshing(false);
  };

  const current = weather.data?.current;
  const cond = weatherCondition(current?.weather_code);
  const days = weather.data?.daily ?? [];
  const today = days[0];
  const range = days.reduce(
    (r, d) => ({ min: Math.min(r.min, d.temp_min_c ?? r.min), max: Math.max(r.max, d.temp_max_c ?? r.max) }),
    { min: 99, max: -99 },
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      showsVerticalScrollIndicator={false}
    >
      <ScreenTitle
        eyebrow="Weather"
        title={location.label ?? 'Your farm'}
        subtitle={
          location.source === 'gps'
            ? 'Using your current location'
            : location.source === 'profile'
              ? 'Using your saved farm location'
              : location.source === 'default'
                ? 'Showing Accra'
                : null
        }
      />

      {location.source === 'default' && location.permission === 'denied' ? (
        <Pressable onPress={() => Linking.openSettings()} style={{ marginBottom: spacing.lg }}>
          <Banner tone="info" title="See weather for your own farm" message="Turn on location for AgroSense in settings, or add farm coordinates in your profile." />
        </Pressable>
      ) : null}

      {!location.coords || weather.isLoading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={200} rounded={radius.xl} />
          <Skeleton height={320} rounded={radius.lg} />
        </View>
      ) : weather.isError || !weather.data ? (
        <ErrorState message={getErrorMessage(weather.error, 'The forecast is unavailable right now.')} onRetry={() => weather.refetch()} />
      ) : (
        <>
          {/* Now */}
          <Enter>
          <View style={styles.now}>
            <View style={styles.nowTop}>
              <View>
                <Text style={styles.temp} color={colors.white} tabular>
                  {current?.temperature_c != null ? `${Math.round(current.temperature_c)}°` : '—'}
                </Text>
                <Text variant="bodyStrong" color={colors.white}>
                  {cond.label}
                </Text>
                {today ? (
                  <Text variant="small" color="rgba(255,255,255,0.75)">
                    High {fmt(today.temp_max_c)} · Low {fmt(today.temp_min_c)}
                  </Text>
                ) : null}
              </View>
              <Feather name={cond.icon} size={56} color="rgba(255,255,255,0.9)" />
            </View>
            <View style={styles.nowStats}>
              <NowStat icon="droplet" label="Humidity" value={current?.humidity_pct != null ? `${Math.round(current.humidity_pct)}%` : '—'} />
              <NowStat icon="wind" label="Wind" value={current?.wind_kph != null ? `${Math.round(current.wind_kph)} km/h` : '—'} />
              <NowStat
                icon="cloud-rain"
                label="Rain today"
                value={today?.precipitation_probability_pct != null ? `${Math.round(today.precipitation_probability_pct)}%` : `${(today?.precipitation_mm ?? 0).toFixed(1)} mm`}
              />
            </View>
          </View>
          </Enter>
          {weather.data.stale ? (
            <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.sm }}>
              Showing the last saved forecast — the live forecast is temporarily unavailable.
            </Text>
          ) : null}

          {/* Advisory */}
          <SectionHeader title={`Farm advice${advisory.data?.crop_name ? ` · ${advisory.data.crop_name}` : ''}`} />
          {advisory.isLoading ? (
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Skeleton width="85%" height={18} />
                <Skeleton height={14} />
                <Skeleton width="70%" height={14} />
              </View>
            </Card>
          ) : advisory.data ? (
            <Card>
              <Text variant="subheading">{advisory.data.headline}</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                <Outlook icon="cloud-rain" text={advisory.data.rainfall_outlook} />
                <Outlook icon="thermometer" text={advisory.data.temperature_outlook} />
              </View>
              {advisory.data.recommendations.length ? (
                <View style={{ gap: spacing.sm + 2, marginTop: spacing.lg }}>
                  <Text variant="overline" color={colors.inkMuted}>
                    This week
                  </Text>
                  {advisory.data.recommendations.map((r, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Feather name="check" size={16} color={colors.brand} style={{ marginTop: 3 }} />
                      <Text variant="body" style={{ flex: 1 }}>
                        {r}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {advisory.data.warnings.length ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                  {advisory.data.warnings.map((w, i) => (
                    <Banner key={i} tone="warning" message={w} />
                  ))}
                </View>
              ) : null}
            </Card>
          ) : (
            <Card>
              <Text variant="small" color={colors.inkSoft}>
                Advice is unavailable right now. Pull down to try again.
              </Text>
            </Card>
          )}

          {/* 7 days */}
          <SectionHeader title="Next 7 days" />
          <Card padded={false}>
            {days.map((d, i) => (
              <Enter key={d.date} index={i} step={50}>
                {i > 0 ? <View style={styles.rule} /> : null}
                <DayRow d={d} min={range.min} max={range.max} />
              </Enter>
            ))}
          </Card>
          <Text variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.md }}>
            Forecast data by Open-Meteo.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const fmt = (t: number | null | undefined) => (t == null ? '—' : `${Math.round(t)}°`);

function NowStat({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Feather name={icon} size={12} color="rgba(255,255,255,0.7)" />
        <Text variant="caption" color="rgba(255,255,255,0.7)">
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong" color={colors.white} tabular>
        {value}
      </Text>
    </View>
  );
}

function Outlook({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Feather name={icon} size={15} color={colors.inkMuted} style={{ marginTop: 3 }} />
      <Text variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function DayRow({ d, min, max }: { d: DailyForecast; min: number; max: number }) {
  const cond = weatherCondition(d.weather_code);
  const span = Math.max(1, max - min);
  const lo = d.temp_min_c ?? min;
  const hi = d.temp_max_c ?? max;
  const rain = d.precipitation_probability_pct;
  return (
    <View
      style={styles.day}
      accessible
      accessibilityLabel={`${relativeDay(d.date)}: ${cond.label}, high ${fmt(d.temp_max_c)}, low ${fmt(d.temp_min_c)}${rain != null ? `, ${Math.round(rain)}% chance of rain` : ''}`}
    >
      <Text variant="bodyStrong" style={{ width: 82 }}>
        {relativeDay(d.date)}
      </Text>
      <View style={{ width: 54, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Feather name={cond.icon} size={17} color={cond.icon === 'sun' ? colors.sun : colors.inkSoft} />
        {rain != null && rain >= 20 ? (
          <Text variant="caption" color={colors.info} tabular>
            {Math.round(rain)}%
          </Text>
        ) : null}
      </View>
      <Text variant="small" color={colors.inkMuted} tabular style={{ width: 30, textAlign: 'right' }}>
        {fmt(d.temp_min_c)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { left: `${((lo - min) / span) * 100}%`, right: `${100 - ((hi - min) / span) * 100}%` }]} />
      </View>
      <Text variant="smallStrong" tabular style={{ width: 30 }}>
        {fmt(d.temp_max_c)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  now: { backgroundColor: colors.brand, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xl },
  nowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  temp: { fontFamily: fonts.display, fontSize: 72, lineHeight: 78, letterSpacing: -2 },
  nowStats: { flexDirection: 'row', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: spacing.lg },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surfaceSunken, marginHorizontal: spacing.xs },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.sun },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.lg },
});
