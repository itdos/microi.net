export const CONTACT_ROLE_API = '/apiengine/get-sys-user-roles'
export const CONTACT_USER_API = '/apiengine/get-sysUser-list'

function firstDefined(...values) {
	return values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
}

export function normalizeRoleOptions(items = []) {
	if (!Array.isArray(items)) return []

	const seen = new Set()
	return items.reduce((options, item) => {
		const source = item && typeof item === 'object' ? item : { value: item, label: item }
		const labelValue = firstDefined(
			source.label,
			source.Label,
			source.Name,
			source.name,
			source.Value,
			source.value,
			source.Text,
			source.text,
			source.Key,
			source.key
		)
		if (labelValue === undefined) return options

		const label = String(labelValue).trim()
		const idValue = firstDefined(
			source.id,
			source.Id,
			source.Key,
			source.key,
			source.value,
			source.Value,
			label
		)
		const id = String(idValue).trim()
		if (!id || !label || seen.has(id)) return options

		seen.add(id)
		options.push({ id, label })
		return options
	}, [])
}

export function extractRoleOptions(response) {
	const data = response && Array.isArray(response.Data) ? response.Data : []
	return normalizeRoleOptions(data)
}

export function buildContactRequest({ pageIndex, pageSize, keyword, roleIds, roleNames }) {
	const selectedRoleIds = Array.isArray(roleIds)
		? roleIds.map(id => String(id || '').trim()).filter(Boolean)
		: []
	const selectedRoleNames = Array.isArray(roleNames)
		? roleNames.map(name => String(name || '').trim()).filter(Boolean)
		: []
	const normalizedKeyword = String(keyword || '').trim()

	return {
		url: CONTACT_USER_API,
		data: {
			_PageIndex: pageIndex,
			_PageSize: pageSize,
			Keyword: normalizedKeyword,
			RoleIds: selectedRoleIds,
			RoleNames: selectedRoleNames
		}
	}
}

export function normalizeContact(contact) {
	if (!contact || typeof contact !== 'object') return contact
	return {
		...contact,
		DepartmentName: contact.DepartmentName || contact.DeptName || ''
	}
}
