<?php
/**
 * @var array $_
 * @var \OCP\IL10N $l
 */
style('immich_nc_app', 'style');
?>

<div id="immich-bridge-app"></div>

<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="<?php print_unescaped(\OC::$server->getURLGenerator()->linkTo('immich_nc_app', 'js/main.js')); ?>"></script>
