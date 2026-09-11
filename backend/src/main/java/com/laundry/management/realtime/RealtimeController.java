package com.laundry.management.realtime;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController @RequestMapping("/api/realtime")
public class RealtimeController {
    private final RealtimeSseService realtime;
    public RealtimeController(RealtimeSseService realtime){this.realtime=realtime;}
    @GetMapping(path="/stream",produces=MediaType.TEXT_EVENT_STREAM_VALUE) public SseEmitter stream(){return realtime.connect();}
}
