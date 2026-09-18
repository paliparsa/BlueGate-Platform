<?php
require_once __DIR__ . '/../app/bootstrap.php';
migrate();
header('Content-Type: text/plain; charset=utf-8');
echo "BlueGate Platform tables installed / updated successfully.\n";
