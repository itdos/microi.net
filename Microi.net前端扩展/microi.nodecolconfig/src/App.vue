<template>
  <div>
    <nodeColConfig :DataAppend="DataAppend"></nodeColConfig>
  </div>
</template>

<script>
import nodeColConfig from "./components/node-col-config";
export default {
  data() {
    return {
      // 此处为模拟传入DataAppend
      DataAppend:{
        TableId:'c8236e7c-2859-4d3d-aed0-a4a68e7674bc',
        Data:'[{"Id": "7d160388-4fd6-4e27-a83e-dc633d889f12","Name": "Canshu","Label": "参数","Display": true,"Edit": false,"Notice": false}]'
      },
      // 此处为模拟传入token（会过期，需实时修改
      token:'eyJhbGciOiJSUzUxMiIsInR5cCI6ImF0K2p3dCJ9.eyJuYmYiOjE2NDU1ODI2ODYsImV4cCI6MTY0NTU4Mzg4NiwiaXNzIjoiaHR0cDovL2F1dGguaXRkb3MuY29tIiwiY2xpZW50X2lkIjoic2hvcGRpeSIsInN1YiI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsImF1dGhfdGltZSI6MTY0NTU4MjY4NiwiaWRwIjoibG9jYWwiLCJJZCI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsIlVzZXJJZCI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsIlVzZXJBY2NvdW50IjoiYzc0ZDY2OWMtYTNkNC0xMWU1LWI2MGQtYjg3MGY0M2VkZDAzIiwibmFtZSI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsImdpdmVuX25hbWUiOiJpdGRvc19HaXZlbk5hbWUiLCJmYW1pbHlfbmFtZSI6Iml0ZG9zX0ZhbWlseU5hbWUiLCJlbWFpbCI6ImFkbWluQGlUZG9zLmNvbSIsInJvbGUiOiJpdGRvc191c2VyIiwianRpIjoiM0ZCMzRBOTU5MTg4Rjk2M0M2QTM5NDNFMjc2NzVCNzQiLCJpYXQiOjE2NDU1ODI2ODYsInNjb3BlIjpbImFwaTEiLCJpVGRvc0FwaSIsIm9wZW5pZCIsInByb2ZpbGUiLCJvZmZsaW5lX2FjY2VzcyJdLCJhbXIiOlsiY3VzdG9tIl19.kL7PHTof4O3NYEx1LzxMjs3emECkB5xt7gPtES1dD3-LQJnArj4GQix4tWZAoiRvoVdZ5G7PWnmzFMFpjK9Cmjkutg2Gg6NgxUUvtOlGu4FrOWMG9eCSPms57LQ-zH-gFBfag7DM61cWUtSVzohPL6bP1Z6VHDC5xKRJKkMbMX-JBNporkCEdleRNn4tmFspPmKO8pKxDNPz8nauU8ShE17zy4XYf9Xc58Lon7N2XK3ZROwKD-5aQ8BVoYH4xzCPU_6U9hOiY3mt4b0zHqFrzw_77Bx4PXhPNb1I10pNMlYgvsST6aqbth2mFU2UPdidtrj70KQCvsEaI-djc8DvVQ',

    };
  },
  components: {
    nodeColConfig
  },
  methods: {
    
  },
  mounted(){
    // 有用到接口所以需要设置token，此处为模拟
    localStorage.setItem('authorization', this.token);
    // 获取本地缓存的接口地址，此处为模拟
    localStorage.setItem('DiyApiBase', 'https://api-china.itdos.com');
  },
};
</script>

<style>
</style>