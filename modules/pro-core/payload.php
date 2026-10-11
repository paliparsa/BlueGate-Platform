<?php
function veyra_pro_admin_payload(): array {
    return [
        'admin_roles'=>admin_list_roles(),
        'forecast'=>admin_revenue_forecast(),
        'notification_campaigns'=>admin_notification_campaigns(60),
        'monitoring'=>veyra_monitoring_dashboard(),
        'routing'=>veyra_routing_dashboard(),
        'advanced'=>function_exists('veyra_advanced_dashboard')?veyra_advanced_dashboard():[],
    ];
}
