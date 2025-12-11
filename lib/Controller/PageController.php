<?php

declare(strict_types=1);

namespace OCA\ImmichBridge\Controller;

use OCA\ImmichBridge\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUserSession;

class PageController extends Controller {

    private IUserSession $userSession;
    private IURLGenerator $urlGenerator;

    public function __construct(
        IRequest $request,
        IUserSession $userSession,
        IURLGenerator $urlGenerator
    ) {
        parent::__construct(Application::APP_ID, $request);
        $this->userSession = $userSession;
        $this->urlGenerator = $urlGenerator;
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     *
     * Main page of the app
     *
     * @return TemplateResponse
     */
    public function index(): TemplateResponse {
        $appWebPath = $this->urlGenerator->linkTo(Application::APP_ID, '');
        
        return new TemplateResponse(
            Application::APP_ID,
            'main',
            [
                'appWebPath' => rtrim($appWebPath, '/'),
            ]
        );
    }
}
