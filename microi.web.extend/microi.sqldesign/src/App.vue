<template>
  <div>
    <DiySqlDesign
      ref="DiySqlDesign"
      :model.sync="code4"
    ></DiySqlDesign>
  </div>
</template>

<script>
import DiySqlDesign from "./components/diy-SqlDesign";
export default {
  data() {
    return {
      code4:'',
      // 此处为模拟传入token（会过期，需实时修改
      token:'eyJhbGciOiJSUzUxMiIsInR5cCI6ImF0K2p3dCJ9.eyJuYmYiOjE2NDU1ODU3NDYsImV4cCI6MTY0NTU4Njk0NiwiaXNzIjoiaHR0cDovL2F1dGguaXRkb3MuY29tIiwiY2xpZW50X2lkIjoic2hvcGRpeSIsInN1YiI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsImF1dGhfdGltZSI6MTY0NTU4NTc0NiwiaWRwIjoibG9jYWwiLCJJZCI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsIlVzZXJJZCI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsIlVzZXJBY2NvdW50IjoiYzc0ZDY2OWMtYTNkNC0xMWU1LWI2MGQtYjg3MGY0M2VkZDAzIiwibmFtZSI6ImM3NGQ2NjljLWEzZDQtMTFlNS1iNjBkLWI4NzBmNDNlZGQwMyIsImdpdmVuX25hbWUiOiJpdGRvc19HaXZlbk5hbWUiLCJmYW1pbHlfbmFtZSI6Iml0ZG9zX0ZhbWlseU5hbWUiLCJlbWFpbCI6ImFkbWluQGlUZG9zLmNvbSIsInJvbGUiOiJpdGRvc191c2VyIiwianRpIjoiMzNDNjVBREUxMzhGNDkyQUQwQzc1OUJBRDM0MThFQkMiLCJpYXQiOjE2NDU1ODU3NDYsInNjb3BlIjpbImFwaTEiLCJpVGRvc0FwaSIsIm9wZW5pZCIsInByb2ZpbGUiLCJvZmZsaW5lX2FjY2VzcyJdLCJhbXIiOlsiY3VzdG9tIl19.JzyOUzghZ3yQHZdFtLvJ4lQjygPuRXMAHHQEKv2GX3umYd7qgzhF5pbEgHs5tRtr8DahvfuKyjnSBW0UXO41UPT9HG_w-O1UlCGY9boo5MAtFh6CgtrZzX8IeJG9WRlk1qlGhGIoxZS-euOEJIkUqq70XVVCLVjrp9Gx7XAD8FbqkiEXDHINlk3bHpZbsYmyE3FO8z8OfcKpWxbPCaWChiXyBpT11nu2rKE8Y3sOWmo3I0rqeFuzrvX4G6X_ojZEs0MFz5cN_Cghiveq7ljMImC2b4skeDw6evM6R5i_aZXLxQQgXwV_Yj8JX6VJGeBEOpSxvDB3aXEDDJ4R9Kee-Q',

    };
  },
  components: {
    DiySqlDesign
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