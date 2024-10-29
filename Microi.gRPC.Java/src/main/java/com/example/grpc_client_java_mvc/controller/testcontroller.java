package com.example.grpc_client_java_mvc.controller;

import SysUserPackage.SysUserProtoGrpc;
import greet.GreeterGrpc;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

@RestController
@RequestMapping("/hello")
public class testcontroller {
    @RequestMapping("/word")
    public String word(){
        //Java 调用 .net Microi.net Grpc 提供的微服务。
        var channel = ManagedChannelBuilder.forAddress("localhost",50001).usePlaintext().build();
        try {
            var sysUserClient = SysUserProtoGrpc.newBlockingStub(channel);
            var sysUserRequest = SysUserPackage.SysUser.SysUserArgument.newBuilder();
            sysUserRequest.setAccount("admin");
            sysUserRequest.setPwd("1234567");
            sysUserRequest.setOsClient("xjy");
            var sysUserResult =  sysUserClient.login(sysUserRequest.build());

            var client = GreeterGrpc.newBlockingStub(channel);
            var request = greet.Greet.HelloRequest.newBuilder().setName("Anderson.").build();
            var result =  client.sayHello(request);
            return result.getMessage() + (sysUserResult.getCode() == 1 ? "登陆成功！" : "登陆失败：" + sysUserResult.getMsg());
        }catch(Exception ex){
            return ex.getMessage();
        }finally {
            channel.shutdown();
        }
//        return "ERROR";
    }
}