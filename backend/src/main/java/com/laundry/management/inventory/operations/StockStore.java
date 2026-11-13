package com.laundry.management.inventory.operations;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.*;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

/** Parameterized persistence inside the caller's Spring transaction. Ledger/revision writes are insert-only. */
@Repository
public class StockStore {
    final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public StockStore(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc;this.json=json; }
    public JdbcTemplate jdbc(){return jdbc;}
    public List<Map<String,Object>> rows(String sql,Object...args) {
        return jdbc.query(sql,(rs,n)->{Map<String,Object> row=new LinkedHashMap<>();var md=rs.getMetaData();
            for(int i=1;i<=md.getColumnCount();i++){String key=md.getColumnLabel(i).toLowerCase(Locale.ROOT);StringBuilder camel=new StringBuilder();boolean upper=false;
                for(char c:key.toCharArray()){if(c=='_'){upper=true;continue;}camel.append(upper?Character.toUpperCase(c):c);upper=false;}
                Object value=rs.getObject(i);if(value instanceof Timestamp t)value=t.toInstant().toString();if(value instanceof java.sql.Date d)value=d.toLocalDate().toString();row.put(camel.toString(),value);}
            return row;},args);
    }
    public Map<String,Object> one(String sql,Object...args) { var rows=rows(sql,args);if(rows.isEmpty())throw com.laundry.management.operations.application.OperationsAccess.missing();return rows.get(0); }
    public long insert(String sql,Object...args) {
        var key=new GeneratedKeyHolder();jdbc.update(c->{var p=c.prepareStatement(sql,new String[]{"id"});for(int i=0;i<args.length;i++)p.setObject(i+1,args[i]);return p;},key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }
    public String json(Object value) { try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("Cannot serialize stock snapshot",e);} }
    public Map<String,Object> parse(Object value) { try{return json.readerFor(new TypeReference<LinkedHashMap<String,Object>>(){}).with(com.fasterxml.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).readValue(String.valueOf(value));}catch(Exception e){throw new IllegalStateException("Cannot read stock snapshot",e);} }
    public List<Map<String,Object>> list(Object value) { try{return json.readValue(String.valueOf(value),new TypeReference<List<Map<String,Object>>>(){});}catch(Exception e){throw new IllegalStateException("Cannot read stock effects",e);} }
    public static long id(Map<String,Object> row,String key) { return ((Number)row.get(key)).longValue(); }
    public static BigDecimal dec(Map<String,Object> row,String key) {Object n=row.get(key);return n==null?BigDecimal.ZERO:new BigDecimal(n.toString());}
    public static boolean bool(Map<String,Object> row,String key) {Object b=row.get(key);return Boolean.TRUE.equals(b)||(b instanceof Number n&&n.intValue()!=0);}
    public static String text(Map<String,Object> row,String key) {return row.get(key)==null?null:row.get(key).toString();}
    public static Timestamp time(Instant time) {return Timestamp.from(time);}
}
