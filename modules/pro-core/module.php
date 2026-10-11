<?php
// License gate removed — features always available
require_once __DIR__.'/routing.php';
require_once __DIR__.'/monitoring.php';
require_once __DIR__.'/advanced.php';
require_once __DIR__.'/migration.php';
require_once __DIR__.'/commerce_ops.php';
require_once __DIR__.'/payload.php';
require_once __DIR__.'/api.php';
/* Shared core calls canonical names; expose them only while physical Pro Core exists. */
function veyra_pro_core_manifest(): array { return ['slug'=>'pro-core','version'=>'2.1.5']; }
veyra_module_mark_loaded('pro-core',veyra_pro_core_manifest());
