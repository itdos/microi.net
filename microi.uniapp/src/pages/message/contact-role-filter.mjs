export const SYS_USER_ROLE_FIELD_ID = 'bb6b3659-9f82-47c9-92b1-e2988a5845ae'

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
	const fieldResult = response && Array.isArray(response.Data) ? response.Data[0] : null
	const data = fieldResult && fieldResult.Result ? fieldResult.Result.Data : null
	return normalizeRoleOptions(data)
}

export function buildContactRequest({ pageIndex, pageSize, keyword, roleNames }) {
	const selectedRoleNames = Array.isArray(roleNames)
		? roleNames.map(name => String(name || '').trim()).filter(Boolean)
		: []
	const normalizedKeyword = String(keyword || '').trim()

	if (selectedRoleNames.length > 0) {
		return {
			url: '/apiengine/get-sysUser-list',
			data: {
				_PageIndex: pageIndex,
				_PageSize: pageSize,
				Keyword: normalizedKeyword,
				RoleNames: selectedRoleNames
			}
		}
	}

	return {
		url: '/api/SysUser/GetSysUserPublicInfo',
		data: {
			State: 1,
			_PageIndex: pageIndex,
			_PageSize: pageSize,
			_Keyword: normalizedKeyword
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
