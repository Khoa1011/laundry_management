package com.laundry.management.operations;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class OperationsFoundationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BranchRepository branches;
    @Autowired UserAccountRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    private Branch branch, other;
    private UserAccount manager;
    private String token;

    @BeforeEach void setup() throws Exception {
        String suffix=UUID.randomUUID().toString().substring(0,8);
        branch=branches.saveAndFlush(new Branch("FI"+suffix,"Foundation"));
        other=branches.saveAndFlush(new Branch("FO"+suffix,"Other branch"));
        manager=account("fm"+suffix,"MANAGER",branch);
        token=login(manager.getUsername());
    }

    @Test void catalogsPersistWithVersionedUpdatesAndGeneratedCodes() throws Exception {
        JsonNode created=create("inventory/warehouses",request("Kho chính"));
        assertTrue(created.path("code").asText().matches(branch.getCode()+"-KHO-000001"));
        ObjectNode update=request("Kho mới").put("version",created.path("version").asLong());
        perform(put("/api/inventory/warehouses/"+created.path("id")).content(update.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Kho mới"));
        perform(put("/api/inventory/warehouses/"+created.path("id")).content(update.toString())).andExpect(status().isConflict());
        perform(get("/api/inventory/warehouses/"+created.path("id")).param("branchId",branch.getId().toString())).andExpect(status().isOk());
        perform(get("/api/inventory/warehouses").param("branchId",branch.getId().toString()).param("search","Kho mới")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        create("inventory/categories",request("Hóa chất"));
        create("inventory/suppliers",request("Nhà cung cấp").put("phone","0901234567").put("email","contact@example.test").put("address","Địa chỉ riêng"));
        create("finance/accounts",request("Quỹ tiền mặt").put("accountType","CASH"));
        create("finance/categories",request("Điện nước").put("direction","EXPENSE"));
        assertEquals(6,jdbc.queryForObject("select count(*) from operations_audit where branch_id=?",Integer.class,branch.getId()));
    }

    @Test void unitsPackagesAndItemDecimalsUseExactApiValues() throws Exception {
        var item=item();
        assertEquals("9007199254740993.12",item.path("referencePrice").asText());
        assertTrue(item.path("minimumStock").isTextual());
        long unit=item.path("baseUnitId").asLong();
        var pack=create("inventory/conversions",request("Can 5 lít").put("itemId",item.path("id").asLong()).put("inputUnitId",unit).put("factor","5.000001"));
        assertEquals("5.000001",pack.path("factor").asText());
        long mass=create("inventory/units",request("Kilogram").put("dimension","MASS")).path("id").asLong();
        perform(post("/api/inventory/conversions").content(request("Sai nhóm").put("itemId",item.path("id").asLong()).put("inputUnitId",mass).put("factor","2").toString())).andExpect(status().isUnprocessableEntity());
        perform(post("/api/inventory/conversions").content(request("Không hợp lệ").put("itemId",item.path("id").asLong()).put("inputUnitId",unit).put("factor","0").toString())).andExpect(status().isBadRequest());
    }

    @Test void immutableUnitDimensionAndBaseUnitProtectFutureSnapshots() throws Exception {
        var item=item();
        long id=item.path("baseUnitId").asLong();
        perform(put("/api/inventory/units/"+id).content(request("Đổi nhóm").put("version",0).put("dimension","MASS").toString())).andExpect(status().isUnprocessableEntity());
        long second=create("inventory/units",request("ml").put("dimension","VOLUME")).path("id").asLong();
        ObjectNode edit=(ObjectNode)item.deepCopy(); edit.put("baseUnitId",second);
        perform(put("/api/inventory/items/"+item.path("id")).content(edit.toString())).andExpect(status().isUnprocessableEntity());
    }

    @Test void itemThresholdsExpiryAndInactiveReferencesAreValidated() throws Exception {
        var item=item();
        ObjectNode edit=(ObjectNode)item.deepCopy(); edit.put("maximumStock","1"); edit.put("minimumStock","2");
        perform(put("/api/inventory/items/"+item.path("id")).content(edit.toString())).andExpect(status().isUnprocessableEntity());
        edit.remove("maximumStock"); edit.put("trackExpiry",true); edit.put("trackLots",false);
        perform(put("/api/inventory/items/"+item.path("id")).content(edit.toString())).andExpect(status().isUnprocessableEntity());
        var inactive=create("inventory/categories",request("Ngừng dùng").put("active",false));
        edit.put("categoryId",inactive.path("id").asLong());edit.put("trackLots",true);
        perform(put("/api/inventory/items/"+item.path("id")).content(edit.toString())).andExpect(status().isUnprocessableEntity());
    }

    @Test void safeSettingsAreReadWithoutWritesAndSavedWithVersionCheck() throws Exception {
        perform(get("/api/inventory/settings").param("branchId",branch.getId().toString())).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(-1)).andExpect(jsonPath("$.allowNegative").value(false)).andExpect(jsonPath("$.approvalRequired").doesNotExist()).andExpect(jsonPath("$.approvalThreshold").doesNotExist());
        assertEquals(0,jdbc.queryForObject("select count(*) from inventory_settings where branch_id=?",Integer.class,branch.getId()));
        long warehouse=create("inventory/warehouses",request("Kho mặc định")).path("id").asLong();
        ObjectNode body=policy().put("defaultResourceId",warehouse);
        perform(put("/api/inventory/settings").content(body.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(0));
        perform(put("/api/inventory/settings").content(body.toString())).andExpect(status().isConflict());
        perform(put("/api/inventory/warehouses/"+warehouse).content(request("Không được ngừng").put("version",0).put("active",false).toString())).andExpect(status().isUnprocessableEntity());
        long account=create("finance/accounts",request("Ngân hàng").put("accountType","BANK")).path("id").asLong();
        perform(put("/api/finance/settings").content(policy().put("defaultResourceId",account).toString())).andExpect(status().isOk()).andExpect(jsonPath("$.currency").value("VND"));
    }

    @Test void crossBranchListsDetailsUpdatesAndReferencesAreDenied() throws Exception {
        var created=create("inventory/warehouses",request("Kho"));
        perform(get("/api/inventory/warehouses").param("branchId",other.getId().toString())).andExpect(status().isForbidden());
        perform(get("/api/inventory/warehouses/"+created.path("id")).param("branchId",other.getId().toString())).andExpect(status().isForbidden());
        ObjectNode update=request("Đổi").put("branchId",other.getId()).put("version",0);
        perform(put("/api/inventory/warehouses/"+created.path("id")).content(update.toString())).andExpect(status().isForbidden());
        var second=account("other"+UUID.randomUUID(),"MANAGER",other);
        String old=token;token=login(second.getUsername());
        long foreign=create("inventory/warehouses",request("Kho khác").put("branchId",other.getId())).path("id").asLong();token=old;
        perform(put("/api/inventory/settings").content(policy().put("defaultResourceId",foreign).toString())).andExpect(status().isNotFound());
        perform(get("/api/inventory/warehouses/"+foreign).param("branchId",branch.getId().toString())).andExpect(status().isNotFound());
    }

    @Test void readonlyUserCannotMutateAndHasNoFinancialAccess() throws Exception {
        UserAccount reader=account("reader"+UUID.randomUUID(),"RECEPTIONIST",branch); token=login(reader.getUsername());
        perform(get("/api/inventory/items").param("branchId",branch.getId().toString())).andExpect(status().isOk());
        perform(post("/api/inventory/warehouses").content(request("Không được tạo").toString())).andExpect(status().isForbidden());
        perform(get("/api/finance/accounts").param("branchId",branch.getId().toString())).andExpect(status().isForbidden());
        perform(get("/api/inventory/history").param("branchId",branch.getId().toString())).andExpect(status().isForbidden());
    }

    @Test void denyOverridesAdministratorRoleAndAllowGrantsOnlySelectedCapability() throws Exception {
        UserAccount admin=account("admin"+UUID.randomUUID(),"ADMIN",branch);
        override(admin.getId(),"finance.account.read","DENY"); token=login(admin.getUsername());
        perform(get("/api/finance/accounts").param("branchId",branch.getId().toString())).andExpect(status().isForbidden());
        UserAccount reader=account("allow"+UUID.randomUUID(),"RECEPTIONIST",branch);
        override(reader.getId(),"finance.account.read","ALLOW");token=login(reader.getUsername());
        perform(get("/api/finance/accounts").param("branchId",branch.getId().toString())).andExpect(status().isOk());
        perform(post("/api/finance/accounts").content(request("Denied").put("accountType","CASH").toString())).andExpect(status().isForbidden());
        jdbc.update("update user_permission_overrides set effect='DENY' where user_id=?",reader.getId());em.clear();
        perform(get("/api/finance/accounts").param("branchId",branch.getId().toString())).andExpect(status().isForbidden());
    }

    @Test void priceReadAndWriteAreSeparateAndHiddenPriceSurvivesOrdinaryEdit() throws Exception {
        var item=item();
        override(manager.getId(),"inventory.cost.read","DENY");override(manager.getId(),"inventory.cost.update","DENY");em.clear();
        perform(get("/api/inventory/items/"+item.path("id")).param("branchId",branch.getId().toString())).andExpect(status().isOk()).andExpect(jsonPath("$.referencePrice").isEmpty());
        ObjectNode edit=(ObjectNode)item.deepCopy();edit.putNull("referencePrice");edit.put("name","Tên đã sửa");
        perform(put("/api/inventory/items/"+item.path("id")).content(edit.toString())).andExpect(status().isOk());
        assertEquals("9007199254740993.12",jdbc.queryForObject("select reference_price from inventory_items where id=?",java.math.BigDecimal.class,item.path("id").asLong()).toPlainString());
        edit.put("version",1);edit.put("referencePrice","1");
        perform(put("/api/inventory/items/"+item.path("id")).content(edit.toString())).andExpect(status().isForbidden());
    }

    @Test void auditIsScopedPagedAndContainsNoSupplierContacts() throws Exception {
        var supplier=create("inventory/suppliers",request("Private supplier").put("email","private@example.test").put("phone","0901234567").put("note","Secret note"));
        String history=perform(get("/api/inventory/history").param("branchId",branch.getId().toString()).param("size","1")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andReturn().getResponse().getContentAsString();
        assertFalse(history.contains("private@example.test"));assertFalse(history.contains("0901234567"));assertFalse(history.contains("Secret note"));
        perform(put("/api/inventory/suppliers/"+supplier.path("id")).content(request("Stale").put("version",999).toString())).andExpect(status().isConflict());
        assertEquals(1,jdbc.queryForObject("select count(*) from operations_audit where branch_id=?",Integer.class,branch.getId()));
    }

    @Test void paginationSearchEscapingAndRequestValidationAreBounded() throws Exception {
        create("inventory/warehouses",request("Kho 100%"));create("inventory/warehouses",request("Kho thường"));
        perform(get("/api/inventory/warehouses").param("branchId",branch.getId().toString()).param("search","%")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        perform(get("/api/inventory/warehouses").param("size","101")).andExpect(status().isUnprocessableEntity());
        perform(post("/api/inventory/warehouses").content(request(" ").toString())).andExpect(status().isBadRequest());
        perform(post("/api/inventory/suppliers").content(request("Invalid").put("email","bad").toString())).andExpect(status().isBadRequest());
    }

    @Test void unauthenticatedAndUnknownEndpointsNeverExposeData() throws Exception {
        mvc.perform(get("/api/inventory/items")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/finance/accounts")).andExpect(status().isUnauthorized());
        perform(delete("/api/inventory/warehouses/1")).andExpect(status().isMethodNotAllowed());
    }

    private JsonNode item() throws Exception {
        long category=create("inventory/categories",request("Hóa chất")).path("id").asLong();
        long unit=create("inventory/units",request("Lít").put("dimension","VOLUME")).path("id").asLong();
        return create("inventory/items",request("Nước giặt").put("categoryId",category).put("baseUnitId",unit).put("referencePrice","9007199254740993.12").put("minimumStock","0.000001").put("trackLots",false).put("trackExpiry",false));
    }

    @Test void settingsIgnoreLegacyApprovalInputWithoutRewritingHistoricalColumns() throws Exception {
        jdbc.update("insert into finance_settings(branch_id,approval_required,approval_threshold,allow_negative,updated_at,updated_by) values (?,TRUE,123456,FALSE,CURRENT_TIMESTAMP,?)",branch.getId(),manager.getId());
        perform(get("/api/finance/settings").param("branchId",branch.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.approvalRequired").doesNotExist()).andExpect(jsonPath("$.approvalThreshold").doesNotExist());
        var request=policy().put("version",0).put("approvalRequired",true).put("approvalThreshold","obsolete-invalid-value");
        perform(put("/api/finance/settings").content(request.toString())).andExpect(status().isOk())
            .andExpect(jsonPath("$.approvalRequired").doesNotExist()).andExpect(jsonPath("$.approvalThreshold").doesNotExist());
        assertTrue(jdbc.queryForObject("select approval_required from finance_settings where branch_id=?",Boolean.class,branch.getId()));
        assertEquals("allowNegative,defaultResourceId",jdbc.queryForObject("select changed_fields from operations_audit where branch_id=? and module='finance'",String.class,branch.getId()));
    }

    @Test void dynamicPermissionCatalogExcludesRetiredWorkflowAndInactiveGrantsCannotBeAssigned() throws Exception {
        UserAccount admin=account("workflow"+UUID.randomUUID(),"ADMIN",branch);token=login(admin.getUsername());
        String grouped=perform(get("/api/access/permissions/grouped")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(grouped.contains("finance.document.cancel"));assertTrue(grouped.contains("inventory.document.cancel"));
        for(String module:List.of("finance","inventory")) for(String action:List.of("submit","approve","post","reverse")) {
            String code=module+".document."+action;
            assertFalse(grouped.contains("\""+code+"\""));
        }
        Role target=roles.findByCode("MANAGER").orElseThrow();
        perform(put("/api/access/roles/"+target.getId()+"/permissions").content(json.createObjectNode().put("version",target.getVersion()).put("reason","Test retired permission").set("permissionCodes",json.createArrayNode().add("finance.document.approve")).toString()))
            .andExpect(status().isBadRequest());
    }

    @Test void matrixAndOverrideEditsPreserveRetiredAssignmentsWithoutExposingThemAsChoices() throws Exception {
        UserAccount admin=account("compat"+UUID.randomUUID(),"ADMIN",branch);token=login(admin.getUsername());
        Long roleId=roles.findByCode("MANAGER").orElseThrow().getId();
        int retained=jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=? and p.status='INACTIVE'",Integer.class,roleId);
        JsonNode matrix=json.readTree(perform(get("/api/access/roles/"+roleId+"/permissions")).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        ObjectNode save=json.createObjectNode().put("version",matrix.path("version").asLong()).put("reason","Preserve retired history");save.set("permissionCodes",matrix.path("permissionCodes"));
        long managerVersion=jdbc.queryForObject("select authorization_version from users where id=?",Long.class,manager.getId());
        long adminVersion=jdbc.queryForObject("select authorization_version from users where id=?",Long.class,admin.getId());
        perform(put("/api/access/roles/"+roleId+"/permissions").content(save.toString())).andExpect(status().isOk());
        assertEquals(managerVersion+1,jdbc.queryForObject("select authorization_version from users where id=?",Long.class,manager.getId()));
        assertEquals(adminVersion,jdbc.queryForObject("select authorization_version from users where id=?",Long.class,admin.getId()));
        assertEquals(retained,jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=? and p.status='INACTIVE'",Integer.class,roleId));
        override(manager.getId(),"finance.document.approve","ALLOW");
        JsonNode access=json.readTree(perform(get("/api/access/users/"+manager.getId())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertFalse(access.path("overrides").toString().contains("finance.document.approve"));
        ObjectNode replace=json.createObjectNode().put("version",access.path("accessVersion").asLong());replace.putArray("overrides");
        perform(put("/api/access/users/"+manager.getId()+"/overrides").content(replace.toString())).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("select count(*) from user_permission_overrides o join permissions p on p.id=o.permission_id where o.user_id=? and p.code='finance.document.approve'",Integer.class,manager.getId()));
    }

    @Test void newRoleCopiesExcludeRetiredWorkflowGrantsWhileSourceHistoryRemains() throws Exception {
        UserAccount admin=account("copy"+UUID.randomUUID(),"ADMIN",branch);token=login(admin.getUsername());
        Long source=roles.findByCode("MANAGER").orElseThrow().getId();
        int oldCount=jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=? and p.status='INACTIVE'",Integer.class,source);
        assertTrue(oldCount>0);
        JsonNode created=json.readTree(perform(post("/api/access/roles").content(json.createObjectNode().put("displayName","Created workflow copy").put("copyPermissionsFromRoleId",source).toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        JsonNode cloned=json.readTree(perform(post("/api/access/roles/"+source+"/clone").content(json.createObjectNode().put("displayName","Cloned workflow copy").put("copyPermissions",true).put("reason","Copy active permissions only").toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        for(JsonNode copy:List.of(created,cloned)) {
            assertTrue(copy.path("permissionCount").asInt()>0);
            assertEquals(0,jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=? and p.status='INACTIVE'",Integer.class,copy.path("id").asLong()));
        }
        assertEquals(oldCount,jdbc.queryForObject("select count(*) from role_permissions rp join permissions p on p.id=rp.permission_id where rp.role_id=? and p.status='INACTIVE'",Integer.class,source));
    }
    private ObjectNode request(String name) { return json.createObjectNode().put("branchId",branch.getId()).put("name",name).put("active",true); }
    private ObjectNode policy() { return json.createObjectNode().put("branchId",branch.getId()).put("version",-1).put("allowNegative",false); }
    private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception { return mvc.perform(request.header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)); }
    private JsonNode create(String path, ObjectNode body) throws Exception { return json.readTree(perform(post("/api/"+path).content(body.toString())).andExpect(status().isCreated()).andReturn().getResponse().getContentAsByteArray()); }
    private UserAccount account(String name, String role, Branch branch) {
        UserAccount user=new UserAccount(name,passwords.encode("foundation-test-only"),name,branch);user.addRole(roles.findByCode(role).orElseThrow());user=users.saveAndFlush(user);user.assignBranch(branch,true);return users.saveAndFlush(user);
    }
    private String login(String name) throws Exception { return json.readTree(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json.createObjectNode().put("username",name).put("password","foundation-test-only").toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("accessToken").asText(); }
    private void override(Long user, String code, String effect) { jdbc.update("insert into user_permission_overrides(user_id,permission_id,effect,reason) select ?,id,?,'Foundation authorization test' from permissions where code=?",user,effect,code);em.clear(); }
}
