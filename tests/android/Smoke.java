package com.shiji.life.test;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.webkit.WebView;
import java.io.*;
import java.lang.reflect.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.json.*;

/** Separate, locally signed instrumentation APK. No user credentials are used. */
public class Smoke extends Instrumentation {
    private Activity activity;
    private WebView web;
    private int checks=0;
    private long visualId=0;
    private boolean realSession=false;
    @Override public void onCreate(Bundle b){super.onCreate(b);realSession=b!=null&&"true".equals(b.getString("realSession"));start();}
    private String js(String script) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        runOnMainSync(()->web.evaluateJavascript(script,r->{value.set(r);latch.countDown();}));
        if(!latch.await(10,TimeUnit.SECONDS))throw new Exception("WebView JS timeout");
        return value.get();
    }
    private void expect(String script,String message) throws Exception {
        if(!"true".equals(js(script)))throw new Exception(message);
        checks++;
    }
    private void waitFor(String script) throws Exception {
        for(int i=0;i<100;i++){if("true".equals(js(script)))return;Thread.sleep(100);}
        throw new Exception("Timed out: "+script);
    }
    private void screenshot(String name) throws Exception {
        CountDownLatch painted=new CountDownLatch(1);
        runOnMainSync(()->web.postVisualStateCallback(++visualId,new WebView.VisualStateCallback(){
            @Override public void onComplete(long id){painted.countDown();}
        }));
        if(!painted.await(10,TimeUnit.SECONDS))throw new Exception("WebView paint timeout");
        Thread.sleep(1400);
        Bitmap image=getUiAutomation().takeScreenshot();
        if(image==null)throw new Exception("No screenshot");
        File file=new File(getTargetContext().getExternalFilesDir(null),name+".png");
        try(FileOutputStream out=new FileOutputStream(file)){image.compress(Bitmap.CompressFormat.PNG,100,out);}
        image.recycle();
    }
    private void submit(String values) throws Exception {
        js("(function(){const f=document.querySelector('#overlay form');const values="+values+";for(const k of Object.keys(values))f.elements[k].value=values[k];f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true;})()");
    }
    @Override public void onStart(){
        Bundle report=new Bundle();
        try {
            Intent launch=new Intent();launch.setClassName("com.shiji.life","com.shiji.life.MainActivity");launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity=startActivitySync(launch);
            Field field=activity.getClass().getDeclaredField("web");field.setAccessible(true);web=(WebView)field.get(activity);
            waitFor("!!window.shiji && !!document.querySelector('.shell')");
            expect("!!window.NativeHub","Native bridge must be present");
            AtomicReference<Integer> bottom=new AtomicReference<>();
            runOnMainSync(()->bottom.set(((android.view.View)web.getParent()).getPaddingBottom()));
            if(bottom.get()<=0)throw new Exception("System navigation inset was not applied");checks++;
            screenshot("native-empty");
            js("window.shiji.setState(HubCore.empty());window.shiji.openGoal();");
            submit("{\"name\":\"安卓持久化验证目标\",\"amount\":\"200000\",\"deadline\":\"2030-01-01\",\"scope\":\"all\"}");
            waitFor("shiji.state.goals.length===1");
            expect("document.querySelector('#overlay').innerHTML===''","Goal form closes after save");
            File stateFile=new File(getTargetContext().getFilesDir(),"workspace.json");
            boolean saved=false;
            for(int i=0;i<50;i++){
                if(stateFile.exists()){
                    try(InputStream in=new FileInputStream(stateFile)){
                        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
                        while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
                        if(new JSONObject(new String(out.toByteArray(),"UTF-8")).optJSONArray("goals").length()==1){saved=true;break;}
                    }catch(Exception ignored){}
                }
                Thread.sleep(100);
            }
            if(!saved)throw new Exception("Native atomic state persistence failed");checks++;
            // Check real AndroidKeyStore encryption using a non-secret synthetic token.
            Method store=activity.getClass().getDeclaredMethod("storeToken",String.class);store.setAccessible(true);
            Method read=activity.getClass().getDeclaredMethod("readToken");read.setAccessible(true);
            store.invoke(activity,"non-secret-native-qa-token");
            if(!"non-secret-native-qa-token".equals(read.invoke(activity)))throw new Exception("AndroidKeyStore round trip failed");
            String encrypted=getTargetContext().getSharedPreferences("vault",0).getString("session","");
            if(encrypted.contains("non-secret-native-qa-token")||encrypted.isEmpty())throw new Exception("Token was not encrypted");checks++;
            getTargetContext().getSharedPreferences("vault",0).edit().clear().commit();
            if(realSession){
                // Ephemeral local test input from the user's already-authorized desktop session.
                // It is never bundled, logged, passed on a process command line, or rendered.
                try{
                    ParcelFileDescriptor fd=getUiAutomation().executeShellCommand("cat /data/local/tmp/shiji-qa-session.json");
                    String text;
                    try(InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd)){
                        ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[1024];int n;
                        while((n=in.read(buffer))!=-1){if(bytes.size()+n>12000)throw new Exception("QA input too large");bytes.write(buffer,0,n);}
                        text=new String(bytes.toByteArray(),"UTF-8");
                    }
                    store.invoke(activity,new JSONObject(text).getString("access_token"));
                    Method sync=activity.getClass().getDeclaredMethod("sync");sync.setAccessible(true);
                    JSONObject result=(JSONObject)sync.invoke(activity);
                    if(!result.optBoolean("ok"))throw new Exception("Native real-session read was not successful");
                    JSONArray accounts=result.getJSONArray("accounts");
                    if(accounts.length()==0)throw new Exception("Native account response was empty");
                    for(int i=0;i<accounts.length();i++){
                        JSONObject a=accounts.getJSONObject(i);
                        if(!a.has("reckonIn")||!a.has("balance")||!a.has("currency"))throw new Exception("Account contract mismatch");
                    }
                    report.putInt("nativeSyncAccounts",accounts.length());checks++;
                }finally{
                    getTargetContext().getSharedPreferences("vault",0).edit().clear().commit();
                    ParcelFileDescriptor cleanup=getUiAutomation().executeShellCommand("rm -f /data/local/tmp/shiji-qa-session.json");cleanup.close();
                }
            }
            js("window.shiji.setState(HubCore.demo());window.shiji.navigate('home');");
            expect("HubCore.totals(shiji.state).total===86000","Asset exclusion on native engine");
            expect("document.documentElement.scrollWidth<=innerWidth","Native layout width");
            screenshot("native-home-demo");
            js("window.shiji.navigate('goals');document.querySelector('.goal-card').click();");
            screenshot("native-goal-demo");
            js("window.hubBack();window.shiji.navigate('allocation');");
            expect("document.querySelectorAll('.allocation-row').length===4","Native asset categories");
            screenshot("native-allocation-demo");
            js("window.shiji.navigate('todos');document.querySelector('[data-action=add-task]').click();");
            submit("{\"text\":\"安卓待办验证\",\"deadline\":\"2030-01-01\"}");
            expect("shiji.state.tasks.length===1","Native todo creation");
            js("document.querySelector('[data-action=toggle-task]').click();");
            expect("shiji.state.tasks[0].done===true","Native todo completion");
            screenshot("native-todo-demo");
            report.putString("stream","PASS: "+checks+" checks; native WebView rendering, forms, atomic file persistence, AndroidKeyStore encryption, goals, asset exclusion, allocation and todos.\n");
            finish(Activity.RESULT_OK,report);
        }catch(Throwable e){
            report.putString("stream","FAIL: "+e.getClass().getSimpleName()+": "+e.getMessage()+"\n");
            finish(Activity.RESULT_CANCELED,report);
        }
    }
}
