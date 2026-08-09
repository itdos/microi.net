<template>
  <div class="mci-table-wrap">
    <table class="mci-table">
      <thead><tr><th v-for="column in columns" :key="column.key">{{ column.label }}</th><th v-if="$slots.actions">操作</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="String(row.Id ?? row.id ?? JSON.stringify(row))">
          <td v-for="column in columns" :key="column.key" :title="text(row[column.key])">
            <span v-if="column.tone" class="mci-badge" :data-tone="tone(row[column.key])">{{ text(row[column.key]) }}</span>
            <span v-else>{{ text(row[column.key]) }}</span>
          </td>
          <td v-if="$slots.actions" class="actions"><slot name="actions" :row="row" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
defineProps<{ rows: Record<string, unknown>[]; columns: { key: string; label: string; tone?: boolean }[] }>()
function text(value: unknown): string { return value === null || value === undefined || value === '' ? '—' : String(value) }
function tone(value: unknown): string {
  const normalized = String(value ?? '').toLowerCase()
  if (/critical|high|down|failed|blocked|error/.test(normalized)) return 'danger'
  if (/warning|degraded|unknown|draft|acknowledged|conflict/.test(normalized)) return 'warning'
  if (/healthy|completed|published|ready|enabled|resolved/.test(normalized)) return 'success'
  return 'primary'
}
</script>

<style scoped>
.actions { width: 1%; white-space: nowrap; }
.actions :deep(button) { min-height: 32px; padding: 0 10px; }
</style>
