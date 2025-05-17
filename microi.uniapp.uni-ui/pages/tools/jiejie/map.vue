<template>
  <view class="container">
    <div class="card-container mx-4 my-4 bg-white rounded-lg shadow-lg overflow-hidden">
      <!-- Time search header -->
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center space-x-4">
          <span class="text-gray-700 font-medium">时间范围：</span>
          <div class="flex-1 flex space-x-3 items-center">
            <!-- Period Type Selector -->
            <select 
              v-model="periodType" 
              class="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="year">年</option>
              <option value="quarter">季</option>
              <option value="month">月</option>
            </select>
            
            <!-- Year Selector (always visible) -->
            <select 
              v-model="selectedYear" 
              class="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="year in availableYears" :key="year" :value="year">{{ year }}年</option>
            </select>
            
            <!-- Quarter Selector (visible when periodType is quarter) -->
            <select 
              v-if="periodType === 'quarter'"
              v-model="selectedQuarter" 
              class="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="quarter in [1, 2, 3, 4]" :key="quarter" :value="quarter">Q{{ quarter }}</option>
            </select>
            
            <!-- Month Selector (visible when periodType is month) -->
            <select 
              v-if="periodType === 'month'"
              v-model="selectedMonth" 
              class="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="month in 12" :key="month" :value="month">{{ month }}月</option>
            </select>
            
            <button 
              @click="handleSearch" 
              class="py-0 px-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors h-8 leading-8 text-base"
            >
              搜索
            </button>
          </div>
        </div>
      </div>
      
      <!-- Map container -->
      <div class="map-wrapper p-4">
        <map 
          class="map"
          id="map"
          :latitude="latitude" 
          :longitude="longitude" 
          :markers="markers"
          :polygons="polygons"
          :scale="10"
          :include-points="markers"
          :show-location="true"
          @markertap="markertap"
        ></map>
      </div>
    </div>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, inject, computed } from 'vue'
import { getBrowserLocation, getLocation } from '@/utils'

const latitude = ref(29.855748)
const longitude = ref(121.592474)
const markers = ref([])
const polygons = ref([])
const Microi = inject('Microi')

// Period selection variables
const periodType = ref('month') // Default to month selection
const currentYear = new Date().getFullYear()
const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i) // Current year and 4 years back
const selectedYear = ref(currentYear)
const selectedQuarter = ref(1)
const selectedMonth = ref(new Date().getMonth() + 1) // Current month (1-12)

// 莲都区域边界点（示例数据，需要替换为实际的边界点）
const areaPolygons = {
  '莲都区': {
    points: [
      { latitude: 28.451681, longitude: 119.92047 },
      { latitude: 28.456446, longitude: 119.912 },
      { latitude: 28.439034, longitude: 119.9274 },
      { latitude: 28.445576, longitude: 119.927055 },
      { latitude: 28.45674, longitude: 119.9311 }
    ],
    color: '#1890FF20',
    strokeColor: '#1890FF'
  }
}

onMounted(async () => {
	// const res = await getLocation()
	// console.log(111,res)
  getMapReportPointOrAreaData()
});

const getMapReportPointOrAreaData = async (params = {}) => {
  // If no period type is specified, default to current month
  if (!params.startDate || !params.endDate) {
    const defaultDateRange = calculateDateRange('month', selectedYear.value, null, selectedMonth.value)
    params.startDate = defaultDateRange.startDate
    params.endDate = defaultDateRange.endDate
    params.periodType = 'month'
    params.year = selectedYear.value
    params.month = selectedMonth.value
  }
  
  const res = await Microi.ApiEngine.Run('MapReportPointOrAreaData', params)
  markers.value = [] // Clear previous markers
  polygons.value = [] // Clear previous polygons
  
  if (res.Code === 1) {
    // 处理点位标记
    res.Data.forEach(item => {
      markers.value.push({
        id: item.id,
        longitude: Number(item.longitude),
        latitude: Number(item.latitude),
        width: 32,
        height: 32,
        iconPath: item.icon,
        callout: {
          content: `${item.title}\n完成: ${item.wcsl}/${item.zsl}`,
          color: '#333333',
          fontSize: 12,
          borderRadius: 4,
          bgColor: '#FFFFFF',
          padding: 8,
          display: 'BYCLICK'
        }
      })
    })

    // 添加行政区域边界
    Object.entries(areaPolygons).forEach(([name, area]) => {
      polygons.value.push({
        points: area.points,
        strokeWidth: 2,
        strokeColor: area.strokeColor,
        fillColor: area.color,
        zIndex: 1
      })
    })

    // 如果有标记点，自动调整地图视野
    if (markers.value.length > 0) {
      const avgLat = markers.value.reduce((sum, m) => sum + Number(m.latitude), 0) / markers.value.length
      const avgLng = markers.value.reduce((sum, m) => sum + Number(m.longitude), 0) / markers.value.length
      
      latitude.value = avgLat
      longitude.value = avgLng
    }
  }
}

// Handle marker tap
const markertap = (e) => {
  const markerId = e.detail.markerId
  const marker = markers.value.find(m => m.id === markerId)
  if (marker) {
    console.log('Marker clicked:', marker)
    // Add your logic for marker tap
  }
}

// Updated search function to handle period types
const handleSearch = () => {
  const params = { periodType: periodType.value, year: selectedYear.value }
  
  // Add period-specific params
  if (periodType.value === 'quarter') {
    params.quarter = selectedQuarter.value
  } else if (periodType.value === 'month') {
    params.month = selectedMonth.value
  }
  
  // Calculate date ranges based on period type for the API
  const dateRange = calculateDateRange(periodType.value, selectedYear.value, selectedQuarter.value, selectedMonth.value)
  if (dateRange) {
    params.startDate = dateRange.startDate
    params.endDate = dateRange.endDate
  }
  
  getMapReportPointOrAreaData(params)
}

// Helper function to calculate start and end dates based on period selection
const calculateDateRange = (type, year, quarter, month) => {
  if (type === 'year') {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    }
  } else if (type === 'quarter') {
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = quarter * 3
    const endDay = new Date(year, endMonth, 0).getDate() // Last day of end month
    return {
      startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      endDate: `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`
    }
  } else if (type === 'month') {
    const endDay = new Date(year, month, 0).getDate() // Last day of month
    return {
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${endDay}`
    }
  }
  return null
}
</script>
<style lang="scss" scoped>
.container {
  height: 100vh;
  max-width: 100vw;
  padding: 0;
  margin: 0;
  background-color: #f3f4f6;
  overflow: hidden;
}

.card-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 2rem);
}

.map-wrapper {
  flex: 1;
  position: relative;
}

.map {
  width: 100%;
  height: 100%;
}
</style>