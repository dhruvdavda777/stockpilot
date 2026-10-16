{{- define "stockpilot.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "stockpilot.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "stockpilot.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "stockpilot.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: stockpilot
{{- end }}

{{/* Selector labels for one component. Usage: include "stockpilot.selectorLabels" (dict "ctx" . "component" "backend") */}}
{{- define "stockpilot.selectorLabels" -}}
app.kubernetes.io/name: {{ include "stockpilot.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "stockpilot.image" -}}
{{- printf "%s:%s" .image.repository (default .ctx.Chart.AppVersion .image.tag | toString) }}
{{- end }}

{{- define "stockpilot.postgresHost" -}}
{{- printf "%s-postgresql" (include "stockpilot.fullname" .) }}
{{- end }}

{{- define "stockpilot.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- $a := .Values.postgresql.auth }}
{{- printf "postgresql+psycopg://%s:%s@%s:5432/%s" $a.username (urlquery $a.password) (include "stockpilot.postgresHost" .) $a.database }}
{{- else }}
{{- required "externalDatabase.url is required when postgresql.enabled=false" .Values.externalDatabase.url }}
{{- end }}
{{- end }}
